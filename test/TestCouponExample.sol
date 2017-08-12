pragma solidity ^0.4.2;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/CouponExample.sol";


contract TestCouponExample {

  function testInitialFreeSupplyUsingDeployedContract() {
    CouponExample coupon = CouponExample(DeployedAddresses.CouponExample());

    uint expected = 100;

    Assert.equal(coupon.totalFreeCoupon(), expected, "Free Coupon supply should be 100 initially");
  }

  function testInitialFreeSupplyWithNewCouponExample() {

    uint expected = 99;

    CouponExample coupon = new CouponExample('COUPON test', expected, 0);
    
    Assert.equal(coupon.totalFreeCoupon(), expected, "Owner should have 99 CouponExample initially");
  }

}
