var CouponExample = artifacts.require("./CouponExample.sol");

contract('CouponExample', function(accounts) {

  var user1 = accounts[2];
  const initialBalance_user1 = web3.eth.getBalance(user1)
  console.log(web3.fromWei(initialBalance_user1).toString())

  it("give a coupon to a user", function() {
    var coupon;
    var issuer;
    
    return CouponExample.deployed().then(function(instance) {
      coupon = instance;
      return coupon.creator.call();
    }).then(function(address) {
      creator = address
      return coupon.issue({from: creator});
    }).then(function() {
      return coupon.hasCoupon.call(user1);
    }).then(function(result) {
      assert.equal(result, false, "User1 already acquire this coupon");
      return coupon.giveCoupon(user1,{from: creator});
    }).then(function() {
      return coupon.hasCoupon.call(user1);
    }).then(function(result) {
      assert.equal(result, true, "User1 acquisition didnt work");
    });
  });

});
