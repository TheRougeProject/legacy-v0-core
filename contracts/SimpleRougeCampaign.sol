/*

  Simple campaign contracts

*/

pragma solidity ^0.4.23;

import "./RGETokenInterface.sol";

import "./RougeFactoryInterface.sol";

contract SimpleRougeCampaign {

    string public version = 'v0.7';

    // The Rouge Token contract address
    RGETokenInterface public rge;

    // Factory address & tare settings (1 RGE)
    RougeFactoryInterface public factory;
    uint256 public tare;

    address issuer; // XXX todo owner = initial potential issuer, issuer can be changed ?

    modifier onlyBy(address _address) {
        require(msg.sender == _address);
        _;
    }

    uint32 public issuance;
    uint32 public available = 0;
    uint32 public acquired = 0;
    uint32 public redeemed = 0;

    constructor(address _issuer, uint32 _issuance, address _rge, uint256 _tare, address _factory) public {
        issuer = _issuer;
        issuance = _issuance;
        rge = RGETokenInterface(_rge); 
        tare = _tare;
        factory = RougeFactoryInterface(_factory);
    }

    string public name;
    bool public campaignIssued;
    uint public campaignExpiration;

    function issue(string _name, uint _campaignExpiration) onlyBy(issuer) public {

        // still possible to send RGE post creation, before issuing the campaign
        uint256 rgeBalance = rge.balanceOf(this);
        require(rgeBalance > issuance * tare);

        name = _name;
        campaignIssued = true;
        campaignExpiration = _campaignExpiration;
        available = issuance;
        
    }    

    modifier CampaignOpen() {
        require(campaignIssued);
        require(now < campaignExpiration);
        _;
    }
    
    /* ********** ********** ********** */
    /* the acquisition Register (track if an address has a note) XXX to replace by Int ? */
    
    mapping (address => bool) acquisitionRegister;
    
    function hasNote(address _bearer) constant public returns (bool yes) {
        require(_bearer != issuer);             /* RULE issuer and bearer need to be diffrent */
        return acquisitionRegister[_bearer];
    }
    
    /* low level transfer of a note between bearers  */
    function transfer(address _from, address _to) CampaignOpen private {
        require(_to != issuer);                /* RULE issuer and bearer need to be diffrent */
        require(hasNote(_from));
        acquisitionRegister[_from] = false; 
        acquisitionRegister[_to] = true;
    }

    function distributeNote(address _to) CampaignOpen private returns (bool success) {
        require(_to != issuer);                 /* RULE: issuer and bearer need to be diffrent */
        require(!hasNote(_to));                 /* RULE: only one note per address (but not bearer) */
        if (available > 0) {
            available -= 1;
            acquired += 1;
            acquisitionRegister[_to] = true;
            return true;
        } else {
            return false;
        }
    }
    
    /* ********** ********** ********** */
    /* Demo functions that manage the acquisition process for notes */
    
    function askForNote() CampaignOpen public returns (bool success) {
        require(msg.sender != issuer); 
        require(!hasNote(msg.sender)); /* duplicate test. remove ? */
        
        /* TODO send to approval contract => return always ok in these tests */
        
        return distributeNote(msg.sender);
    }
    
    function giveNote(address _to) onlyBy(issuer) CampaignOpen public returns (bool success) {
        return distributeNote(_to);
    }
    
    /* ********** ********** ********** */
    /* the redemtion Register (track notes effectively redeemed by Bearers) */
    
    mapping (address => bool) redemptionRegister;

    function hasRedeemed(address _bearer) constant public returns (bool yes) {
        require(_bearer != issuer);
        require(hasNote(_bearer));
        return redemptionRegister[_bearer];
    }
    
    function redeemNote(address _bearer) CampaignOpen private returns (bool success) {
        require(_bearer != issuer); 
        require(!hasRedeemed(_bearer));
        redeemed += 1;
        redemptionRegister[_bearer] = true;
        return true;
    }
    
    function useNote() CampaignOpen public returns (bool success) {
        require(msg.sender != issuer); /* SI_10 issuer is excluded for now to simplify tests */
        
        /* TODO global contract expiration test => if expired change state  */
        
        /* TODO send to checkout contract => return always ok in these tests (could put conditions on pos/target)
           require approval from issuer 
        */
        
        return redeemNote(msg.sender);
    }
    
    /* function letsBurn(uint256 _value) onlyBy(issuer) public { */
    /*     rge.burn(_value); */
    /* }     */

    function kill() onlyBy(issuer) public {

        // burn the tare

        rge.burn(tare * (issuance - redeemed));

        // transfer all remaining tokens and ETH to the issuer
        
        uint256 rgeBalance = rge.balanceOf(this);
        
        if ( rge.transfer(issuer, rgeBalance) ) {
            selfdestruct(issuer);
        } 

    }

}
