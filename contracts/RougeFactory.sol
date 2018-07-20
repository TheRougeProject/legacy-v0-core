/*

  Simple Rouge factory and campaign contracts

*/

pragma solidity ^0.4.23;

import "./SimpleRougeCampaign.sol";

// XXX RougeRegistry is temporary helper

import "./RougeRegistry.sol";

contract RougeFactory is RougeRegistry {
    
    // The Rouge Token contract address
    RGETokenInterface public rge;
    uint256 public tare;
    
    address owner;

    mapping (address => uint256) public deposit; // per campaign ... 

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyBy(address _address) {
        require(msg.sender == _address);
        _;
    }

    function setParams (address _rge, uint256 _tare) onlyBy(owner) public {
        rge = RGETokenInterface(_rge); 
        tare = _tare;
    }

    event NewRougeCampaign(address issuer, address campaign, uint32 _issuance);

    function createCampaign(address _issuer, uint32 _issuance, uint256 _tokens) public {

        SimpleRougeCampaign c = new SimpleRougeCampaign(_issuer, _issuance, rge, tare, this);
        
        // XXX no need to check rge set ? transfer would revert ...
        rge.transfer(c, _tokens);     // transfer tokens to the campaign contract ...

        emit NewRougeCampaign(_issuer, c, _issuance);

        // XXX beta sugar getters / not stricly necessary...
        
        deposit[c] = _tokens;
        add_campaign(_issuer, c);
        
    }

}
