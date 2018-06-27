
pragma solidity ^0.4.23;

contract RougeRegistryInterface {

    function get_all_count() public view returns(uint count);
    function get_all_campaign(uint index) public view returns(address);
    function get_count(address issuer) public view returns(uint count);
    function get_campaign(address issuer, uint index) public view returns(address);
    function get_mycount() public view returns(uint count);
    function get_mycampaign(uint index) public view returns(address);

}
