var CouponExample = artifacts.require("./CouponExample.sol");

module.exports = function(deployer) {

  deployer.deploy(CouponExample, 'Coupon demo v0.1', 100, 20);

};
