// SPDX-License-Identifier: AGPL-3.0-only
/*

  Simple campaign contract

*/

pragma solidity ^0.6.0;

import "./IRGEToken.sol";

import "./IRougeFactory.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

library RougeCampaign {

    function getHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory result = new bytes(64);
        string memory characterString = "0123456789abcdef";
        bytes memory characters = bytes(characterString);
        for (uint8 i = 0; i < 32; i++) {
            result[i * 2] = characters[(uint8(value[i]) & 0xF0) >> 4];
            result[i * 2 + 1] = characters[uint8(value[i]) & 0xF];
        }
        return string(result);
    }

    // web3.eth.sign compat prefix
    function prefixed(bytes32 _hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n74Rouge ID: ", getHexString(_hash)));
    }
    
}

contract SimpleRougeCampaign {
 
    bytes2 public version = 0x0021;

    // The Rouge Token contract address
    IRGEToken public rge;

    // Factory address & tare settings
    IRougeFactory public factory;
    uint256 public tare;

    address payable public issuer; // TODO owner != initial issuer

    enum Authorization { All, Role, Attachment, Issuance, Acquisition, Redemption, Kill }

    mapping (address => mapping (uint => bool)) public isAuthorized;

    modifier isAttestor(Authorization _auth) {
        require(isAuthorized[msg.sender][uint(Authorization.All)] || isAuthorized[msg.sender][uint(_auth)]);
        _;
    }

    event AttestorAddition(address indexed attestor, Authorization auth);
    
    function addAttestor(address _attestor, Authorization[] memory _auths) isAttestor(Authorization.Role) public {
        for (uint i = 0; i < _auths.length; i++) {
            isAuthorized[_attestor][uint(_auths[i])] = true;
            emit AttestorAddition(_attestor, _auths[i]);
        }
    }
    
    event AttestorRemoval(address indexed attestor, Authorization auth);

    function removeAttestor(address _attestor, Authorization[] memory _auths) isAttestor(Authorization.Role) public {
        for (uint i = 0; i < _auths.length; i++) {
            isAuthorized[_attestor][uint(_auths[i])] = false;
            emit AttestorRemoval(_attestor, _auths[i]);
        }
    }

    uint32 public issuance;
    uint32 public available;
    uint32 public acquired;
    uint32 public redeemed;

    constructor(address payable _issuer, uint32 _issuance, address _rge, uint256 _tare, address _factory) public {
        require(_issuance > 0);

        issuer = _issuer;
        issuance = _issuance;
        rge = IRGEToken(_rge);
        tare = _tare;
        factory = IRougeFactory(_factory);

        // bootstrap role system
        isAuthorized[issuer][uint(Authorization.All)] = true;
        emit AttestorAddition(issuer, Authorization.All);
    }

    uint256 public acquisitionFuelProvision;
    
    event AcquisitionFuel(uint256 _value);
    
    function setAcquisitionFuelProvision() payable isAttestor(Authorization.Issuance) public {
        require(!campaignIssued);
        require(msg.value >= issuance);
        acquisitionFuelProvision = msg.value / issuance;
        emit AcquisitionFuel(msg.value / issuance);
    }

    struct Attachment {
        AttachmentClass class;
        address caller;
        uint qty;
    }

    enum AttachmentClass { Fuel, ERC20, ERC721 }
    Attachment[] attachments;

    event NewAttachment(AttachmentClass indexed class, address _contract, uint256 _value);
    
    function attachFuel() payable isAttestor(Authorization.Attachment) public {
        require(!campaignIssued);
        require(msg.value >= issuance);
        attachments.push(Attachment({
            class: AttachmentClass.Fuel,
            caller: address(0),  
            qty: msg.value / issuance
        }));
        emit NewAttachment(AttachmentClass.Fuel, address(0), msg.value / issuance);
    }

    function attachERC20(IERC20 _erc20, uint256 _value) isAttestor(Authorization.Attachment) public {
        require(!campaignIssued);
        require(_value >= issuance);
        require(_erc20.transferFrom(msg.sender, address(this), _value));
        require(address(rge) != address(_erc20));
        attachments.push(Attachment({
            class: AttachmentClass.ERC20,
            caller: address(_erc20),  
            qty: _value / issuance
        }));
        emit NewAttachment(AttachmentClass.ERC20, address(_erc20), _value);
    }

    uint256[] erc721TokenIds;
    event ReceivedERC721(address _operator, address _from, uint256 _tokenId, bytes _data);

    bytes4 private constant ERC721_RECEIVED = 0x150b7a02;
    function onERC721Received(address _operator, address _from, uint256 _tokenId, bytes memory _data ) public returns(bytes4) {
        require(!campaignIssued);
        emit ReceivedERC721( _operator, _from, _tokenId, _data);
        erc721TokenIds.push(_tokenId);
        return ERC721_RECEIVED;
    }
        
    function attachERC721(IERC721 _erc721, uint256 _value) isAttestor(Authorization.Attachment) public {
        require(!campaignIssued);
        require(_value >= issuance);
        require(_erc721.balanceOf(address(this)) >= issuance);
        require(erc721TokenIds.length >= issuance);
        attachments.push(Attachment({
            class: AttachmentClass.ERC721,
            caller: address(_erc721),  
            qty: _value / issuance
        }));
        emit NewAttachment(AttachmentClass.ERC721, address(_erc721), _value);
    }

    bytes4 public scheme;
    string public name;
    bool public campaignIssued;
    uint public campaignExpiration;

    event Issuance(bytes2 indexed version, address indexed issuer, bytes4 indexed scheme, string name, uint campaignExpiration);

    function issue(bytes4 _scheme, string memory _name, uint _campaignExpiration) isAttestor(Authorization.Issuance) public {
        require(!campaignIssued);

        // still possible to send RGE post creation, before issuing the campaign
        uint256 rgeBalance = rge.balanceOf(address(this));
        require(rgeBalance >= issuance * tare);

        // minimum campaign duration 12 hours, maximum 360 days (XXX could be a param for tare ?)
        require(_campaignExpiration >= now + 60*60*12);
        require(_campaignExpiration <= now + 60*60*24*360);
        
        name = _name;
        campaignIssued = true;
        campaignExpiration = _campaignExpiration;
        available = issuance;
        scheme = _scheme;

        emit Issuance(version, issuer, _scheme, _name, _campaignExpiration);
    }    

    // Authorization is handled by issue()
    function issueWithAttestor(bytes4 _scheme, string memory _name, uint _campaignExpiration, address _attestor, Authorization[] memory _auths) public {
        issue(_scheme, _name, _campaignExpiration);
        addAttestor(_attestor, _auths);
    }
    
    function getInfo() public view returns (bytes memory) {
        return abi.encodePacked(issuer, scheme, campaignExpiration, name);
    }

    function getState() public view returns (bytes memory) {
        return abi.encodePacked(issuance, campaignIssued, available, acquired, redeemed);
    }

    modifier CampaignOpen() {
        require(campaignIssued);
        require(now < campaignExpiration);
        _;
    }
    
    mapping (address => bool) public acquisitionRegister;
    
    function hasNote(address _bearer) public view returns (bool yes) {
        require(_bearer != issuer);             /* RULE issuer and bearer need to be diffrent */
        return acquisitionRegister[_bearer];
    }
    
    event Acquisition(address indexed bearer);

    function acquisition(address payable _bearer) CampaignOpen private returns (bool success) {
        require(_bearer != issuer);                 /* RULE: issuer and bearer need to be diffrent */
        require(!hasNote(_bearer));                 /* RULE: only one note per address */
        /* require(!transferRegister[_bearer]);        /* RULE transfer is not reversible */
        if (available > 0) {
            available -= 1;
            acquired += 1;
            acquisitionRegister[_bearer] = true;
            if (acquisitionFuelProvision > 0) {
                _bearer.transfer( acquisitionFuelProvision );
            }
            emit Acquisition(_bearer);
            return true;
        } else {
            return false;
        }
    }

    // _hash is any hashed msg that confirm attestor(often issuer) authorization for the note acquisition
    function acquire(bytes32 _hash, uint8 v, bytes32 r, bytes32 s, address _attestor) CampaignOpen public returns (bool success) {
        require(msg.sender != issuer); 
        require(_hash == keccak256(abi.encodePacked('acceptAcquisition', this, msg.sender)));
        require(isAuthorized[_attestor][uint(Authorization.All)] || isAuthorized[_attestor][uint(Authorization.Acquisition)]);
        require(ecrecover(RougeCampaign.prefixed(_hash), v, r, s) == _attestor);
        return acquisition(msg.sender);
    }
    
    function distributeNote(address payable _bearer) CampaignOpen isAttestor(Authorization.Acquisition) public returns (bool success) {
        return acquisition(_bearer);
    }
    
    mapping (address => bool) public transferRegister;
    
    /* low level transfer of a note between bearers */
    function transfer(address _from, address _to) CampaignOpen private {
        require(_to != issuer);                /* RULE issuer and bearer need to be different */
        require(hasNote(_from));
        acquisitionRegister[_from] = false; 
        transferRegister[_from] = true;        /* RULE transfer is not reversible */
        acquisitionRegister[_to] = true;
    }

    mapping (address => bool) public redemptionRegister;

    function hasRedeemed(address _bearer) public view returns (bool yes) {
        /* require(_bearer != issuer); already tested with hasNote */
        return redemptionRegister[_bearer];
    }

    event Redemption(address indexed bearer);

    function redemption(address payable _bearer) CampaignOpen private returns (bool success) {
        require(hasNote(_bearer));
        require(!hasRedeemed(_bearer));
        redeemed += 1;
        redemptionRegister[_bearer] = true;

        for (uint i = 0; i < attachments.length; i++) {
            if (attachments[i].class == AttachmentClass.Fuel) {
                _bearer.transfer( attachments[i].qty );
            }
            if (attachments[i].class == AttachmentClass.ERC20) {
                IERC20 _erc20 = IERC20(attachments[i].caller);
                _erc20.transfer(_bearer, attachments[i].qty );
            }
            if (attachments[i].class == AttachmentClass.ERC721) {
                IERC721 _erc721 = IERC721(attachments[i].caller);
                for (uint j = 0; j < attachments[i].qty; j++) {
                    _erc721.safeTransferFrom(address(this), _bearer, erc721TokenIds[erc721TokenIds.length - 1]);
                    erc721TokenIds.pop();
                }
            }
        }

        emit Redemption(_bearer);
        return true;
    }

    // _hash is any hashed msg that confirm attestor(often issuer) authorization for the note redemption
    function redeem(bytes32 _hash, uint8 v, bytes32 r, bytes32 s, address _attestor) CampaignOpen public returns (bool success) {
        require(msg.sender != issuer); 
        require(_hash == keccak256(abi.encodePacked('acceptRedemption', this, msg.sender)));
        require(isAuthorized[_attestor][uint(Authorization.All)] || isAuthorized[_attestor][uint(Authorization.Redemption)]);
        require(ecrecover(RougeCampaign.prefixed(_hash), v, r, s) == _attestor);
        return redemption(msg.sender);
    }
        
    function acceptRedemption(address payable _bearer, bytes32 _hash, uint8 v, bytes32 r, bytes32 s)
        CampaignOpen isAttestor(Authorization.Redemption) public returns (bool success) {
        require(_hash == keccak256(abi.encodePacked('acceptRedemption', this, _bearer)));
        require(ecrecover(RougeCampaign.prefixed(_hash), v, r, s) == _bearer);
        return redemption(_bearer);
    }
        
    function getWorkflow(address _bearer) public view returns (bytes memory) {
        return abi.encodePacked(hasNote(_bearer), hasRedeemed(_bearer));
    } 
    
    function kill() isAttestor(Authorization.Kill) public {

        // burn the tare for unredeemed notes if campaign has started

        if (campaignIssued) {
            rge.burn(tare * (issuance - redeemed));
        }

        // approve issuer to get back all remaining erc20 or erc721

        for (uint i = 0; i < attachments.length; i++) {
            if (attachments[i].class == AttachmentClass.ERC20) {
                IERC20 _erc20 = IERC20(attachments[i].caller);
                 _erc20.approve(issuer, attachments[i].qty * issuance);
            }
            if (attachments[i].class == AttachmentClass.ERC721) {
                IERC721 _erc721 = IERC721(attachments[i].caller);
                _erc721.setApprovalForAll(issuer, true);
            }
        } 
        
        // transfer all remaining RGE tokens and ETH to the issuer
        
        if ( rge.transfer(issuer, rge.balanceOf(address(this))) ) {
            selfdestruct(issuer);
        } 

    }

}
