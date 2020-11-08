// SPDX-License-Identifier: AGPL-3.0-only
/*

  RGE token Interface

*/

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRGEToken is IERC20 {

    /*
    uint8 public decimals;
    
    address public crowdsale;
    uint public endTGE;
    string public version;
    uint256 public reserveY1;
    uint256 public reserveY2;

    address public factory;
    */

    function setFactory(address _factory) external;

    function newCampaign(uint32 _issuance, uint256 _value) external;

    event Burn(address indexed burner, uint256 value);

    function burn(uint256 _value) external returns (bool success);

}
