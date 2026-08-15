// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// 仓单合约接口：烘焙履行后铸造对应克数的咖啡豆仓单。
interface IWarehouseReceipt {
    function mintForRoast(address to, uint256 grams, string calldata metadataURI)
        external returns (uint256 batchId);
}

/**
 * @title RoastPackageToken
 * @notice 标准化烘焙服务凭证（ERC-721）。每个 tokenId 对应一个烘焙包实例。
 *
 * 修正点（A3）：
 *  1) checks-effects-interactions：先更新状态、再发起外部调用（JBP 划转 / 仓单铸造 / 退款）；
 *  2) nonReentrant 防重入；
 *  3) packageExists 校验，避免对不存在/已销毁的包操作；
 *  4) 履行后通过 IWarehouseReceipt 铸造对应克数仓单（可选，需 setWarehouse 接通）；
 *  5) 退款路径：状态置 Cancelled 后再执行外部转账，失败则整体回滚。
 */
contract RoastPackageToken is ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _tokenIds; // OZ v5 已移除 Counters，直接使用 uint256 计数器

    IERC20 public jbpToken;             // JBP 积分合约（联盟链台账）
    IWarehouseReceipt public warehouse; // 仓单合约（可选，履行后铸造仓单）

    enum PackageStatus { Created, Purchased, InProgress, Fulfilled, Cancelled }

    struct RoastPackage {
        uint256 weightGrams;   // 烘焙重量（克）
        string beanType;       // 咖啡豆品种
        string roastCurve;     // 烘焙曲线标识（如 "medium-01"）
        uint256 priceJBP;      // 售价（JBP）
        address buyer;         // 当前持有者/购买者
        PackageStatus status;  // 状态
        uint256 createdAt;
        uint256 fulfilledAt;
    }

    mapping(uint256 => RoastPackage) public packages;
    mapping(uint256 => bool) public packageExists;

    event PackageMinted(uint256 indexed tokenId, uint256 weightGrams, string beanType,
                        string roastCurve, uint256 priceJBP);
    event PackagePurchased(uint256 indexed tokenId, address indexed buyer, uint256 amountJBP);
    event PackageFulfilled(uint256 indexed tokenId, uint256 fulfillmentTimestamp, uint256 receiptBatchId);
    event PackageCancelled(uint256 indexed tokenId);

    constructor(address jbpToken_) ERC721("Jebi Roast Package", "JRP") Ownable(msg.sender) {
        jbpToken = IERC20(jbpToken_);
    }

    function setWarehouse(address warehouse_) external onlyOwner {
        warehouse = IWarehouseReceipt(warehouse_);
    }

    /**
     * @dev 平台提走托管在合约内的 JBP（购买款先入合约，退款由合约托管支付）。
     */
    function withdrawJBP(uint256 amount) external onlyOwner {
        require(jbpToken.transfer(owner(), amount), "JRP: withdraw failed");
    }

    /**
     * @dev 平台管理员铸造烘焙包，初始状态 Created，由平台持有待售。
     */
    function mintPackage(
        address to,
        uint256 weightGrams,
        string calldata beanType,
        string calldata roastCurve,
        uint256 priceJBP,
        string calldata tokenURI_
    ) external onlyOwner returns (uint256) {
        require(weightGrams > 0, "JRP: weight must be > 0");
        uint256 newTokenId = ++_tokenIds;

        _mint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        packages[newTokenId] = RoastPackage({
            weightGrams: weightGrams,
            beanType: beanType,
            roastCurve: roastCurve,
            priceJBP: priceJBP,
            buyer: address(0),
            status: PackageStatus.Created,
            createdAt: block.timestamp,
            fulfilledAt: 0
        });
        packageExists[newTokenId] = true;

        emit PackageMinted(newTokenId, weightGrams, beanType, roastCurve, priceJBP);
        return newTokenId;
    }

    /**
     * @dev 用户支付 JBP 购买烘焙包。
     * 修正：CEI —— 先更新状态与持有关系，再发起外部 JBP 划转；nonReentrant 防重入。
     */
    function purchasePackage(uint256 tokenId) external nonReentrant {
        require(packageExists[tokenId], "JRP: package does not exist");
        require(_ownerOf(tokenId) == owner(), "JRP: package not listed for sale");
        require(msg.sender != owner(), "JRP: owner cannot buy own package");

        RoastPackage storage pkg = packages[tokenId];
        require(pkg.status == PackageStatus.Created, "JRP: package not available");

        // 1) 先更新状态（checks-effects）
        pkg.buyer = msg.sender;
        pkg.status = PackageStatus.Purchased;
        _transfer(owner(), msg.sender, tokenId);

        // 2) 再执行外部调用（interactions）：JBP 划入合约托管，退款有保障；平台经 withdrawJBP 提走
        require(
            jbpToken.transferFrom(msg.sender, address(this), pkg.priceJBP),
            "JRP: JBP transfer failed"
        );

        emit PackagePurchased(tokenId, msg.sender, pkg.priceJBP);
    }

    /**
     * @dev 管理员履行烘焙包。状态先行，仓单铸造（外部调用）在后；失败整体回滚。
     */
    function fulfillPackage(uint256 tokenId) external onlyOwner nonReentrant {
        require(packageExists[tokenId], "JRP: package does not exist");
        RoastPackage storage pkg = packages[tokenId];
        require(pkg.status == PackageStatus.Purchased, "JRP: package not purchased");

        pkg.status = PackageStatus.Fulfilled;
        pkg.fulfilledAt = block.timestamp;

        uint256 receiptBatchId;
        if (address(warehouse) != address(0)) {
            receiptBatchId = warehouse.mintForRoast(pkg.buyer, pkg.weightGrams, tokenURI(tokenId));
        }

        emit PackageFulfilled(tokenId, block.timestamp, receiptBatchId);
    }

    /**
     * @dev 管理员取消烘焙包（例如缺货），退回 JBP 并销毁 NFT。
     * 修正：先置状态，再退款，最后销毁；退款失败 revert 则状态一并回滚。
     */
    function cancelPackage(uint256 tokenId) external onlyOwner nonReentrant {
        require(packageExists[tokenId], "JRP: package does not exist");
        RoastPackage storage pkg = packages[tokenId];
        require(pkg.status == PackageStatus.Purchased, "JRP: package not purchased");

        address refundTo = pkg.buyer;
        uint256 refundAmount = pkg.priceJBP;

        pkg.buyer = address(0);
        pkg.status = PackageStatus.Cancelled;

        require(jbpToken.transfer(refundTo, refundAmount), "JRP: refund failed");
        _burn(tokenId);
        packageExists[tokenId] = false;

        emit PackageCancelled(tokenId);
    }

    function getPackage(uint256 tokenId) external view returns (RoastPackage memory) {
        require(packageExists[tokenId], "JRP: package does not exist");
        return packages[tokenId];
    }
}