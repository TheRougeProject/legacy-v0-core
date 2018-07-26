/*

  Simple campaign contracts

*/

pragma solidity ^0.4.23;

import "./RGETokenInterface.sol";

import "./RougeFactoryInterface.sol";

contract SimpleRougeCampaign {

    string public version = 'v0.8';

    // The Rouge Token contract address
    RGETokenInterface public rge;

    // Factory address & tare settings
    RougeFactoryInterface public factory;
    uint256 public tare;

    address public issuer; // XXX todo ? owner != initial issuer

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

    // web3.eth.sign compat prefix XXX mv to lib
    function prefixed(bytes32 _message) internal pure returns (bytes32) {
        return keccak256("\x19Ethereum Signed Message:\n32", _message);
    }

    bytes4 public scheme;
    string public name;
    bool public campaignIssued;
    uint public campaignExpiration;

    event Issuance(bytes4 scheme, string name, uint campaignExpiration);

    function issue(bytes4 _scheme, string _name, uint _campaignExpiration) onlyBy(issuer) public {

        // still possible to send RGE post creation, before issuing the campaign
        uint256 rgeBalance = rge.balanceOf(this);
        require(rgeBalance >= issuance * tare);

        // minimum campaign duration 1 day, maximum 120 days
        require(_campaignExpiration >= now + 60*60*24);
        require(_campaignExpiration <= now + 60*60*24*120);
        
        name = _name;
        campaignIssued = true;
        campaignExpiration = _campaignExpiration;
        available = issuance;
        scheme = _scheme;

        emit Issuance(_scheme, _name, _campaignExpiration);

    }    

    modifier CampaignOpen() {
        require(campaignIssued);
        require(now < campaignExpiration);
        _;
    }
    
    mapping (address => bool) acquisitionRegister;
    
    function hasNote(address _bearer) constant public returns (bool yes) {
        require(_bearer != issuer);             /* RULE issuer and bearer need to be diffrent */
        return acquisitionRegister[_bearer];
    }
    
    event Acquisition(address indexed bearer);

    function acquisition(address _bearer) CampaignOpen private returns (bool success) {
        require(_bearer != issuer);                 /* RULE: issuer and bearer need to be diffrent */
        require(!hasNote(_bearer));                 /* RULE: only one note per address */
        require(!transferRegister[_bearer]);        /* RULE transfer is not reversible */
        if (available > 0) {
            available -= 1;
            acquired += 1;
            acquisitionRegister[_bearer] = true;
            emit Acquisition(_bearer);
            return true;
        } else {
            return false;
        }
    }

    event Log(bytes32 hash);

    // _hash is any hashed msg that confirm issuer authorisation for the note acquisition
    function acquire(bytes32 _hash, uint8 v, bytes32 r, bytes32 s) CampaignOpen public returns (bool success) {
        require(msg.sender != issuer); 
        require(_hash == keccak256('acceptAcquisition', this, msg.sender));
        require(ecrecover(prefixed(_hash), v, r, s) == issuer);
        return acquisition(msg.sender);
    }
    
    function distributeNote(address _bearer) onlyBy(issuer) CampaignOpen public returns (bool success) {
        return acquisition(_bearer);
    }
    
    mapping (address => bool) public transferRegister;
    
    /* low level transfer of a note between bearers  */
    function transfer(address _from, address _to) CampaignOpen private {
        require(_to != issuer);                /* RULE issuer and bearer need to be diffrent */
        require(hasNote(_from));
        acquisitionRegister[_from] = false; 
        transferRegister[_from] = true;        /* RULE transfer is not reversible */
        acquisitionRegister[_to] = true;
    }

    mapping (address => bool) redemptionRegister;

    function hasRedeemed(address _bearer) constant public returns (bool yes) {
        require(_bearer != issuer);
        require(hasNote(_bearer));
        return redemptionRegister[_bearer];
    }

    event Redemption(address indexed bearer);

    function redemption(address _bearer) CampaignOpen private returns (bool success) {
        require(_bearer != issuer); 
        require(!hasRedeemed(_bearer));
        redeemed += 1;
        redemptionRegister[_bearer] = true;
        emit Redemption(_bearer);
        return true;
    }

    // _hash is any hashed msg agreed between issuer and bearer
    // WARNING: replay protection not implemented at protocol level
    function redeem(bytes32 _hash, uint8 v, bytes32 r, bytes32 s) CampaignOpen public returns (bool success) {
        require(_hash == keccak256('acceptRedemption', this, msg.sender));
        require(ecrecover(prefixed(_hash), v, r, s) == issuer);
        return redemption(msg.sender);
    }
        
    function acceptRedemption(address _bearer, bytes32 _hash, uint8 v, bytes32 r, bytes32 s)
        CampaignOpen onlyBy(issuer) public returns (bool success) {
        require(_hash == keccak256('acceptRedemption', this, _bearer));
        require(ecrecover(prefixed(_hash), v, r, s) == _bearer);
        return redemption(_bearer);
    }
        
    function kill() onlyBy(issuer) public {

        // burn the tare for unredeemed notes if campaign has started

        if (campaignIssued) {
            rge.burn(tare * (issuance - redeemed));
        }
        
        // transfer all remaining tokens and ETH to the issuer
        
        uint256 rgeBalance = rge.balanceOf(this);
        
        if ( rge.transfer(issuer, rgeBalance) ) {
            selfdestruct(issuer);
        } 

    }

}
