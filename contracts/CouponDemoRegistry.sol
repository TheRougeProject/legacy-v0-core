
pragma solidity ^0.4.23;

import "./RegistryInterface.sol";

contract CouponDemoRegistry is RegistryInterface {

    string public version = 'v0.2';

    address owner; 

    address[] issuers;
    address[] all_campaigns;
    
    mapping (address => bool) public is_issuer;
    mapping (address => bool) public is_campaign;
    mapping (address => address[]) campaigns;

    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }
    
    constructor() public {
        owner = msg.sender;
    }

    function add_campaign(address _a) public {
        if (!is_issuer[msg.sender]) {
            is_issuer[msg.sender] = true;
            issuers.push(msg.sender);
        }
        all_campaigns.push(_a);
        campaigns[msg.sender].push(_a);
        is_campaign[_a] = true;
    }

    function get_all_count() public view returns(uint count) {
        return all_campaigns.length;
    }
   
    function get_all_campaign(uint index) public view returns(address) {
        return all_campaigns[index];
    }
   
    function get_count(address issuer) public view returns(uint count) {
        return campaigns[issuer].length;
    }
   
    function get_campaign(address issuer, uint index) public view returns(address) {
        return campaigns[issuer][index];
    }
   
    function get_mycount() public view returns(uint count) {
        return campaigns[msg.sender].length;
    }

    function get_mycampaign(uint index) public view returns(address) {
        return campaigns[msg.sender][index];
    }

}
