// SPDX-License-Identifier: AGPL-3.0-only
/*

  Same interface/code as RGEToken but for testnet networks

  with a giveMeRGE faucet like function...

*/

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestRGEToken is ERC20 {
    
    uint8 DECIMALS = 6;

    /* RGEToken */
    address owner; 
    string public version = 'v0.6';
    uint256 public   reserveY1 = 0;
    uint256 public   reserveY2 = 0;

    /* Testnet specific: set a maximum per address, minimum for owner for giveMeRGE function */
    uint256 public  maxBalance =     100000 * 10**uint(DECIMALS);
    uint256 public    ownerMin =  300000000 * 10**uint(DECIMALS);

    uint256 private _totalSupply = 1000000000 * 10**uint(DECIMALS);

    modifier onlyBy(address _address) {
        require(msg.sender == _address);
        _;
    }
    
    constructor() public ERC20("TEST Rouge", "RGE") {
        owner = msg.sender;
        _setupDecimals(DECIMALS);
        _mint(owner, _totalSupply);
    }
    
    function giveMeRGE(uint256 _value) public returns (bool success) {
        require(balanceOf(msg.sender) + _value <= maxBalance);
        require(balanceOf(owner) >= ownerMin + _value);
        _transfer(owner, msg.sender, _value);
        return true;
     }

    /* coupon campaign factory */

    address public factory;

    function setFactory(address _factory) onlyBy(owner) public {
        factory = _factory;
    }

    function newCampaign(uint32 _issuance, uint256 _value) public {
        transfer(factory,_value);
        (bool success,) = factory.call(abi.encodeWithSignature("createCampaign(address,uint32,uint256)",msg.sender,_issuance,_value));
        require(success);
    }

    event Burn(address indexed burner, uint256 value);

    function burn(uint256 _value) public returns (bool success) {
        require(_value > 0);
        require(balanceOf(msg.sender) >= _value);
        _burn(msg.sender, _value);
        emit Burn(msg.sender, _value);
        return true;
    }

}
