/*

  Bridged ERC20 RGE contract to be used on a FOREIGN CHAIN (not Ethereum mainnet, i.e. "home")

  See RougeBridge for the contract on Ethereum mainnet (HOME CHAIN) responsible to lock home RGE for every Bridged RGE

*/

pragma solidity ^0.4.24;

import "./EIP20.sol";

contract BridgeRGEToken is EIP20 {
    
    /* ERC20 */
    uint8 public decimals = 6;
    
    /* RGEToken - keeping the bridged RGE interface as similar as the home RGE */
    address owner; 
    string public version = 'v1.0-0.4'; /* composition rge version + bridge version */
    uint256 public totalSupply = 1000000000 * 10**uint(decimals);
    uint256 public   reserveY1 = 0;
    uint256 public   reserveY2 = 0;

    modifier onlyBy(address _address) {
        require(msg.sender == _address);
        _;
    }
    
    uint public network;                  /* the foreign RGE network ID */
    address public validator;             /* this (foreign) validator */

    address public homeBridge;               
    address public homeValidator;         /* validator in the RougeBridge contract on the home RGE network */

    constructor(uint _network, address _validator, address _homeBridge, address _homeValidator, string _name, string _symbol)
          EIP20 (totalSupply, _name, decimals, _symbol) public {
        owner = msg.sender;
        network = _network;
        validator = _validator;
        homeBridge = _homeBridge;
        homeValidator = _homeValidator;
        balances[address(0)] = totalSupply;      /* RGE on address(0) means there are not circulating on this foreign chain */
    }
    
    function newOwner(address _account) onlyBy(owner) public {
        owner = _account;
    }

    function setValidators(address _validator, address _homeValidator) onlyBy(owner) public {
        validator = _validator;
        homeValidator = _homeValidator;
    }

    bool public bridgeIsOpened = true;

    function toggleBridge(bool _flag) onlyBy(owner) public {
        bridgeIsOpened = _flag;
    }

    modifier BridgeOpen() {
        require(bridgeIsOpened);
        _;
    }
    
    mapping (address => mapping (uint => bool)) public claimed;
    mapping (address => mapping (uint => bool)) public surrendered;

    /* the lockHash can be read on the bridge main chain by the user */
    /* the sealHash is be sure that the RGE tokens are already locked + homeValidator signature */
    
    event RGEClaim(address indexed account, uint indexed _network, uint indexed depositBlock, uint256 value);

    function claim(bytes32 _sealHash, uint256 _value, uint _depositBlock, uint _lockBlock,
                   uint8 vLock, bytes32 rLock, bytes32 sLock, uint8 vAuth, bytes32 rAuth, bytes32 sAuth)
      BridgeOpen public returns (bool success) {
        require(msg.sender != homeValidator); 
        require(balances[address(0)] >= _value);
        require(!claimed[msg.sender][_depositBlock]);           // check if the deposit has not been already claimed
        bytes32 _lockHash = keccak256(abi.encodePacked(msg.sender, _value, network, homeBridge, _depositBlock));
        require(ecrecover(prefixed(_lockHash), vLock, rLock, sLock) == validator);
        require(_sealHash == keccak256(abi.encodePacked(_lockHash, vLock, rLock, sLock, _lockBlock)));
        require(ecrecover(prefixed(_sealHash), vAuth, rAuth, sAuth) == homeValidator);
        claimed[msg.sender][_depositBlock] = true;             // distribute the claim
        balances[address(0)] -= _value;
        balances[msg.sender] += _value;
        emit RGEClaim(msg.sender, network, _depositBlock, _value);
        emit Transfer(address(0), msg.sender, _value);
        return true;
     }

    event Surrender(address indexed account, uint indexed _network, uint indexed depositBlock, uint256 value);

    function surrender(uint256 _value, uint _depositBlock, uint8 vLock, bytes32 rLock, bytes32 sLock) public returns (bool success) {
        require(msg.sender != homeValidator); 
        require(claimed[msg.sender][_depositBlock]);
        require(!surrendered[msg.sender][_depositBlock]);        // not surrendered already
        bytes32 _lockHash = keccak256(abi.encodePacked(msg.sender, _value, network, homeBridge, _depositBlock));
        require(ecrecover(prefixed(_lockHash), vLock, rLock, sLock) == validator);
        require(balances[msg.sender] >= _value);
        surrendered[msg.sender][_depositBlock] = true;        // withdraw tokens from circulation
        balances[msg.sender] -= _value;
        balances[address(0)] += _value;
        emit Transfer(msg.sender, address(0), _value);
        emit Surrender(msg.sender, network, _depositBlock, _value);
        return true;
     }

    function getHexString(bytes32 value) internal pure returns (string) {
        bytes memory result = new bytes(64);
        string memory characterString = "0123456789abcdef";
        bytes memory characters = bytes(characterString);
        for (uint8 i = 0; i < 32; i++) {
            result[i * 2] = characters[uint256((value[i] & 0xF0) >> 4)];
            result[i * 2 + 1] = characters[uint256(value[i] & 0xF)];
        }
        return string(result);
    }

    function prefixed(bytes32 _hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n76Bridge fct: ", getHexString(_hash)));
    }
    
    // This function should be called after a surrender, to publish information necessary to unlock tokens on home chain

    event Repudiate(address indexed account, uint indexed _network, uint indexed depositBlock, uint8 v, bytes32 r, bytes32 s);

    function repudiate(bytes32 _hash, address _account, uint _depositBlock, uint8 v, bytes32 r, bytes32 s)
        onlyBy(validator) public {
        require(msg.sender != _account);
        require(surrendered[_account][_depositBlock]);
        require(_hash == keccak256(abi.encodePacked(_account, network, homeBridge, _depositBlock)));
        require(ecrecover(prefixed(_hash), v, r, s) == msg.sender);
        emit Repudiate(_account, network, _depositBlock, v, r, s);
    }

    /* standard RGE interface  */

    address public factory;

    function setFactory(address _factory) onlyBy(owner) public {
        factory = _factory;
    }

    function newCampaign(uint32 _issuance, uint256 _value) public {
        transfer(factory,_value);
        require(factory.call(bytes4(keccak256("createCampaign(address,uint32,uint256)")),msg.sender,_issuance,_value));
    }

    event Burn(address indexed burner, uint256 value);

    function burn(uint256 _value) public returns (bool success) {
        require(_value > 0);
        require(balances[msg.sender] >= _value);
        balances[msg.sender] -= _value;
        totalSupply -= _value;
        emit Transfer(msg.sender, address(0), _value);
        emit Burn(msg.sender, _value);
        return true;
    }

}
