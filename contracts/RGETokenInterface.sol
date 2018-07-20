/*

  RGE token Interface

*/

pragma solidity ^0.4.23;

import "./EIP20Interface.sol";

contract RGETokenInterface is EIP20Interface {
    
    mapping (address => uint256) public balances;

    string public name;
    string public symbol;
    uint8 public decimals;
    
    address public crowdsale;
    uint public endTGE;
    string public version;
    uint256 public reserveY1;
    uint256 public reserveY2;

    address public factory;

    function newCampaign(uint32 _issuance, uint256 _value) public;

    event Burn(address indexed burner, uint256 value);

    function burn(uint256 _value) public returns (bool success);

}
