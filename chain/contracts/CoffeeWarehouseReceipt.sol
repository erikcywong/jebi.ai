// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title CoffeeWarehouseReceipt
 * @notice 咖啡豆数字仓单（ERC-1155）。
 *
 * 修正点（A3）：
 *  - uri() 在无自定义 URI 时回退 baseURI + id + ".json"，不再返回空字符串；
 *  - 每个批次铸造独立 id（同质化数量 = 克数），URI 指向批次元数据；
 *  - 仓单绑定登记机构登记号（registrationId，如中仓登），实物由第三方仓储 + 保险背书（B3）。
 */
contract CoffeeWarehouseReceipt is ERC1155, Ownable {
    using Strings for uint256;

    mapping(address => bool) public minters;        // 白名单铸造者（平台服务合约）
    string private _baseURI;                        // 默认元数据基址
    mapping(uint256 => string) private _tokenURIs;  // 自定义 URI（覆盖默认）
    mapping(uint256 => uint256) public totalSupplyPerId;
    uint256 public batchCounter;

    event BatchMinted(uint256 indexed batchId, address indexed owner, uint256 grams,
                      string registrationId, string metadataURI);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor() ERC1155("") Ownable(msg.sender) {
        _baseURI = "https://api.jebi.one/metadata/";
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "CWR: not authorized minter");
        _;
    }

    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    /// 修正点：自定义 URI 优先，否则回退到默认 baseURI + id + .json。
    function uri(uint256 id) public view override returns (string memory) {
        string memory custom = _tokenURIs[id];
        if (bytes(custom).length > 0) {
            return custom;
        }
        return string.concat(_baseURI, id.toString(), ".json");
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseURI = baseURI;
    }

    function setTokenURI(uint256 id, string calldata uri_) external onlyOwner {
        _tokenURIs[id] = uri_;
    }

    /// 内部共享铸造逻辑（external 函数经此复用，避免同合约内裸调 external 函数）。
    function _mintBatchInternal(
        address to,
        uint256 grams,
        string memory registrationId,
        string memory metadataURI
    ) internal returns (uint256 batchId) {
        require(grams > 0, "CWR: grams must be > 0");
        batchId = ++batchCounter;
        _mint(to, batchId, grams, "");
        totalSupplyPerId[batchId] += grams;
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[batchId] = metadataURI;
        }
        emit BatchMinted(batchId, to, grams, registrationId, metadataURI);
    }

    /**
     * @dev 铸造一个批次仓单。amount = 克数；registrationId 为登记机构登记号（B3）。
     */
    function mintBatch(
        address to,
        uint256 grams,
        string calldata registrationId,
        string calldata metadataURI
    ) external onlyMinter returns (uint256 batchId) {
        return _mintBatchInternal(to, grams, registrationId, metadataURI);
    }

    /**
     * @dev 烘焙履行后，将烘焙产物折算为新仓单交给买家（由 RoastPackageToken 调用）。
     */
    function mintForRoast(address to, uint256 grams, string calldata metadataURI)
        external onlyMinter returns (uint256 batchId)
    {
        return _mintBatchInternal(to, grams, "ROAST-FULFILLMENT", metadataURI);
    }
}