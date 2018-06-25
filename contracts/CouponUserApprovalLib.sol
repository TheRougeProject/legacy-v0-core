
pragma solidity ^0.4.23;

library CouponUserApprovalLib {
  
	function convert(uint amount,uint conversionRate) returns (uint convertedAmount) {
		return amount * conversionRate;
	}

}
