// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title JebiPoint (JBP)
 * @notice 平台积分台账（境内联盟链存证版本）。
 *
 * 合规定位（修正点 B2 / A3）：
 *  - JBP 是平台积分，不是代币：不可二级市场交易、不可双向兑换法币；
 *  - 1 JBP = 0.1 元仅用于内部记账（锚定法币），用户侧展示为积分而非货币；
 *  - 铸造/销毁仅允许平台白名单合约（onlyMinter），且必须携带业务原因（可审计）；
 *  - 大额预售受《单用途商业预付卡管理办法》约束，充值限额在应用层（backend）执行。
 */
contract JebiPoint is ERC20, Ownable {
    mapping(address => bool) public minters;

    event Mint(address indexed to, uint256 amount, string reason);
    event Burn(address indexed from, uint256 amount, string reason);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor() ERC20("Jebi Point", "JBP") Ownable(msg.sender) {}

    modifier onlyMinter() {
        require(minters[msg.sender], "JBP: not authorized minter");
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

    /**
     * @dev 平台内部服务统一经此铸造（消费返利、数据激励、B 端结算），必须附业务原因。
     */
    function mint(address to, uint256 amount, string calldata reason) external onlyMinter {
        require(amount > 0, "JBP: amount must be > 0");
        _mint(to, amount);
        emit Mint(to, amount, reason);
    }

    /**
     * @dev 消费/服务调用扣除积分，同样记录原因。
     */
    function burn(uint256 amount, string calldata reason) external {
        require(amount > 0, "JBP: amount must be > 0");
        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount, reason);
    }
}
