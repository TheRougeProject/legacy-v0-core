// SPDX-License-Identifier: AGPL-3.0-only
/*

  Bridge to send RGE in other chains (eg POA, ...)

*/

pragma solidity ^0.6.0;

import "./IRGEToken.sol";

contract RougeBridge {
    
    string public version = 'v0.4';
    
    address public owner; 

    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }

    IRGEToken public rge;

    constructor(address _rge) public {
        owner = msg.sender;
        rge = IRGEToken(_rge);
    }

    function newOwner(address _account) onlyBy(owner) public {
        owner = _account;
    }

    mapping (uint => bool) public isOpen;                  /* is the bridge open for this network */
    mapping (uint => address) public homeValidator;        /* address to sign on home network */
    mapping (uint => address) public foreignValidator;     /* address to sign on foreign network */

    function adminBridge(uint _network, bool _flag, address _homeValidator, address _foreignValidator) onlyBy(owner) public {
        isOpen[_network] = _flag;
        homeValidator[_network] = _homeValidator;
        foreignValidator[_network] = _foreignValidator;
    }

    mapping (address => mapping (uint => mapping (uint => uint256))) public escrow;
    mapping (address => mapping (uint => mapping (uint => bytes32))) public escrowSeal;

    event BridgeDeposit(address indexed account, uint indexed _network, uint indexed depositBlock, uint256 value);

    /* caller need to approve RGE transfer beforehand */
    function deposit(uint256 _value, uint _network) public {
        require(isOpen[_network]);
        require(msg.sender != homeValidator[_network]);
        require(msg.sender != foreignValidator[_network]);
        require(_value > 0);                                         
        require(escrow[msg.sender][_network][block.number] == 0);         // only 1 deposit per user/network/block maximum
        assert(escrowSeal[msg.sender][_network][block.number] == bytes32(0));        // there can't be seal already, but let's double check
        require(rge.transferFrom(msg.sender, address(this), _value));              // transfer tokens to this home bridge contract
        emit BridgeDeposit(msg.sender, _network, block.number, _value);
        escrow[msg.sender][_network][block.number] = _value;
    }

    event BridgeWithdraw(address indexed account, uint indexed _network, uint indexed depositBlock, uint256 value);

    function withdraw(uint _network, uint _depositBlock) public {
        require(escrowSeal[msg.sender][_network][_depositBlock] == bytes32(0));  // can't withdraw tokens locked with seal
        uint256 _value = escrow[msg.sender][_network][_depositBlock];
        require(_value > 0);                                              // tokens should still be in escrow
        escrow[msg.sender][_network][_depositBlock] = 0;
        require(rge.transfer(msg.sender, _value));                        // transfer back tokens to sender
        emit BridgeWithdraw(msg.sender, _network, _depositBlock, _value);
    }

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
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n76Bridge fct: ", getHexString(_hash)));
    }

    // Calculating the seal and locking the deposit (foreign authority needs to undersign this)

    event EscrowLocked(address indexed account, uint indexed _network, uint indexed depositBlock, uint8 v, bytes32 r, bytes32 s, bytes32 sealHash);

    function lockEscrow(bytes32 _hash, address _account, uint _network, uint _depositBlock, uint8 v, bytes32 r, bytes32 s)
        onlyBy(homeValidator[_network]) public {
        require(escrow[_account][_network][_depositBlock] > 0);                              // do not work for nothing
        require(_hash == keccak256(abi.encodePacked(
                         _account, escrow[_account][_network][_depositBlock], _network, this, _depositBlock)));
        require(ecrecover(prefixed(_hash), v, r, s) == foreignValidator[_network]);          // confirms that foreign authority has undersigned the tokens Locking
        bytes32 sealHash = keccak256(abi.encodePacked(_hash, v, r, s, block.number));
        escrowSeal[_account][_network][_depositBlock] = sealHash;
        emit EscrowLocked(_account, _network, _depositBlock, v, r, s, sealHash);
    }   

    // The seal needs to be signed again by RGE bridge validator to be used as authorization to claim token in foreign chain
    // The user can claim the bridged tokens as soon as the authorization is visible on the main blockchain (via LOGS)
    // (it's ok if the claiming tx comes before the authorization tx)

    event BridgeAuth(address indexed account, uint indexed _network, uint indexed depositBlock, uint8 v, bytes32 r, bytes32 s);

    function createAuth(address _account, uint _network, uint _depositBlock, uint8 v, bytes32 r, bytes32 s)
        onlyBy(homeValidator[_network]) public {
        require(ecrecover(prefixed(escrowSeal[_account][_network][_depositBlock]), v, r, s) == homeValidator[_network]);
        emit BridgeAuth(_account, _network, _depositBlock, v, r, s);
    }   

    event EscrowUnlocked(address indexed account, uint indexed _network, uint indexed depositBlock);

    function unlockEscrow(bytes32 _hash, address _account, uint _network, uint _depositBlock, uint8 v, bytes32 r, bytes32 s)
        onlyBy(homeValidator[_network]) public {
        require(escrow[_account][_network][_depositBlock] > 0);
        escrowSeal[_account][_network][_depositBlock] != bytes32(0);              // seal should exist
        require(_hash == keccak256(abi.encodePacked(_account, _network, this, _depositBlock)));
        require(ecrecover(prefixed(_hash), v, r, s) == foreignValidator[_network]);
        escrowSeal[_account][_network][_depositBlock] = bytes32(0);               // remove the seal
        emit EscrowUnlocked(_account, _network, _depositBlock);
    }

}
