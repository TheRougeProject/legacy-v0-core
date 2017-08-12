var CouponExample = artifacts.require("./CouponExample.sol");

contract('CouponExample', function(accounts) {

  it("should have 100 free coupons at creation", function() {
    return CouponExample.deployed().then(function(instance) {
      return instance.totalFreeCoupon.call();      
    }).then(function(total) {
      assert.equal(total.valueOf(), 100, "Total free Coupon(s) should be 100 initially");
    });
  });

  it("should change state after issuance", function() {
    var coupon;
    
    return CouponExample.deployed().then(function(instance) {
      coupon = instance;
      return coupon.creator.call();
    }).then(function(creator) {
      return coupon.issue({from: creator});
    }).then(function() {
      return coupon.state.call();
    }).then(function(state) {
      assert.equal(state, 1, "State has not changed after issuance");
    });
  });

});
