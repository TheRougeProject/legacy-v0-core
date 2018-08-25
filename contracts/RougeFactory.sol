/*

  Simple Rouge factory and campaign contracts

*/

pragma solidity ^0.4.24;

import "./SimpleRougeCampaign.sol";

// XXX RougeRegistry is temporary helper

import "./RougeRegistry.sol";

contract RougeFactory is RougeRegistry {
    
    string public version = '0.13.0';

    // The Rouge Token contract address
    RGETokenInterface public rge;
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
        rge = RGETokenInterface(_rge); 
        tare = _tare;
        emit SetFactory(_rge, tare);
    }

    event NewCampaign(address indexed issuer, address indexed campaign, uint32 issuance);

    function createCampaign(address _issuer, uint32 _issuance, uint256 _tokens) public {

        // only rge contract can call createCampaign
        require(msg.sender == address(rge));

        // TODO create MetaRougeCmapign that also instanciate at issue() call
        // alternative use _issuance = zero as trigger for CompleRougeCampaign type
        SimpleRougeCampaign c = new SimpleRougeCampaign(_issuer, _issuance, rge, tare, this);

        // TODO XXX check front running
        require(rge.transfer(c, _tokens));     // transfer tokens to the campaign contract ...

        emit NewCampaign(_issuer, c, _issuance);

        // XXX beta sugar getters / not stricly necessary with good explorer/indexes...
        
        add_campaign(_issuer, c);
        
    }

}
