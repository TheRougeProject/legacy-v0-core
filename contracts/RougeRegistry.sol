
pragma solidity ^0.4.23;

import "./RougeRegistryInterface.sol";

contract RougeRegistry is RougeRegistryInterface {

    address[] issuers;
    address[] all_campaigns;
    
    mapping (address => bool) public is_issuer;
    mapping (address => bool) public is_campaign;
    mapping (address => address[]) campaigns;

    function add_campaign(address _issuer, address _a) internal {
        if (!is_issuer[_issuer]) {
            is_issuer[_issuer] = true;
            issuers.push(_issuer);
        }
        all_campaigns.push(_a);
        campaigns[_issuer].push(_a);
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
   
    function get_last_campaign(address issuer) public view returns(address) {
        return campaigns[issuer][campaigns[issuer].length - 1];
    }
   
    function get_mycount() public view returns(uint count) {
        return campaigns[msg.sender].length;
    }

    function get_mycampaign(uint index) public view returns(address) {
        return campaigns[msg.sender][index];
    }

}
