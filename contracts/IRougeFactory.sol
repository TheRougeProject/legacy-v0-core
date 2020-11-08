// SPDX-License-Identifier: AGPL-3.0-only
/*

  Abstract contract for Rouge Factory contracts

*/

pragma solidity ^0.6.0;

import "./IRGEToken.sol";

interface IRougeFactory {

    /*
    // The Rouge Token contract address
    IRGEToken public rge;

    // Price in RGE of the tare deposit (per token)
    uint256 public tare;

    // owner of the factory
    address owner;
    */

    // owner can (re)set tare price or RGE contract address
    function setParams (address _rge, uint256 _tare) external;

    event NewRougeCampaign(address issuer, address campaign, uint32 _issuance);

    function createCampaign(address _issuer, uint32 _issuance, uint256 _tokens) external;

}
