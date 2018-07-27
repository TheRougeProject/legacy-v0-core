/*

  Abstract contract for Rouge Factory contracts

*/

pragma solidity ^0.4.24;

import "./RGETokenInterface.sol";

contract RougeFactoryInterface {
    
    // The Rouge Token contract address
    RGETokenInterface public rge;

    // Price in RGE of the tare deposit (per token)
    uint256 public tare;

    // owner of the factory
    address owner;

    // owner can (re)set tare price or RGE contract address
    function setParams (address _rge, uint256 _tare) public;

    event NewRougeCampaign(address issuer, address campaign, uint32 _issuance);

    function createCampaign(address _issuer, uint32 _issuance, uint256 _tokens) public;

}
