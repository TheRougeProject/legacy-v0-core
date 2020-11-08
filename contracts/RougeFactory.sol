// SPDX-License-Identifier: AGPL-3.0-only
/*

  Simple Rouge factory and campaign contracts

*/

pragma solidity ^0.6.0;

import "./SimpleRougeCampaign.sol";

contract RougeFactory {
    
    bytes2 public version = 0x0021;

    // The Rouge Token contract address
    IRGEToken public rge;
    uint256 public tare;
    
    address owner;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyBy(address _address) {
        require(msg.sender == _address);
        _;
    }

    event SetFactory(address indexed _rge, uint256 _tare);

    function setParams (address _rge, uint256 _tare) onlyBy(owner) public {
        rge = IRGEToken(_rge);
        tare = _tare;
        emit SetFactory(_rge, tare);
    }

    event NewCampaign(address indexed issuer, address indexed campaign, uint32 issuance);

    function createCampaign(address payable _issuer, uint32 _issuance, uint256 _tokens) public {

        // only rge contract can call createCampaign
        require(msg.sender == address(rge));

        // TODO create MetaRougeCampaign that also instanciate at issue() call
        // alternative use _issuance = zero as trigger for CompleRougeCampaign type

        // Campaign = several Notes Set => Campaign issuance = sum of all notes set issuance.

        SimpleRougeCampaign c = new SimpleRougeCampaign(_issuer, _issuance, address(rge), tare, address(this));

        // TODO XXX check front running
        require(rge.transfer(address(c), _tokens));     // transfer tokens to the campaign contract ...

        emit NewCampaign(_issuer, address(c), _issuance);

    }

}
