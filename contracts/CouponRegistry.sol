pragma solidity ^0.4.12;

contract CouponRegistry {
  uint storedData;

  function set(uint x) {
    storedData = x;
  }

  function get() constant returns (uint) {
    return storedData;
  }
}
