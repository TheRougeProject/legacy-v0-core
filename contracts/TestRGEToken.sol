/*

  Same interface as RGEToken but for test purpose only

*/

import "./EIP20.sol";

pragma solidity ^0.4.23;

contract TestRGEToken is EIP20 {
    
    /* ERC20 */
    string public name = 'TEST Rouge';
    string public symbol = 'RGE';
    uint8 public decimals = 6;
    
    /* RGEToken */
    address owner; 
    string public version = 'v0.01';
    uint256 public totalSupply = 1000000000 * 10**uint(decimals);
    uint256 public   reserveY1 =  300000000 * 10**uint(decimals);
    uint256 public   reserveY2 =  200000000 * 10**uint(decimals);

    modifier onlyBy(address _address) {
        require(msg.sender == _address);
        _;
    }
    
    constructor() EIP20 (totalSupply, name, decimals, symbol) public {
        owner = msg.sender;
        balances[owner] = totalSupply;
    }
    
    function giveMeRGE(uint32 _value) public returns (bool success) {
        require(balances[owner] >= _value);
        balances[owner] -= _value;
        balances[msg.sender] += _value;
        emit Transfer(owner, msg.sender, _value);
        return true;
     }

    /* coupon campaign factory */

    address public factory;

    function setFactory(address _factory) onlyBy(owner) public {
        factory = _factory;
    }

    function newCampaign(uint32 _issuance, uint256 _value) public {
        transfer(factory,_value);
        require(factory.call(bytes4(keccak256("createCampaign(address,uint32,uint256)")),msg.sender,_issuance,_value));
    }

    event Burn(address indexed burner, uint256 value);

    function burn(uint256 _value) public returns (bool success) {
        require(_value > 0);
        require(balances[msg.sender] >= _value);
        balances[msg.sender] -= _value;
        totalSupply -= _value;
        emit Transfer(msg.sender, address(0), _value);
        emit Burn(msg.sender, _value);
        return true;
    }

}
