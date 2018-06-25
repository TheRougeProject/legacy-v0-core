/*
    The Rouge Project - Blochain Coupon platform
    Copyright (C) 2017 Valentin D. Guillois <vdg@rouge.network>
    Copyright (C) 2017 Christophe Le Bars <clb@rouge.network>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    ***************************************************

*/

import "./StandardCoupon.sol";

pragma solidity ^0.4.12;


contract CouponExample is StandardCoupon {

    string public name;
    string public version = 'v0.1';

    uint8 public termDiscount;

    function CouponExample (
        string _name,
        uint256 _initialSupply,
        uint8 _termDiscount
        ) {
      require(_initialSupply > 0); /* hard cap limitation rules TBD */
      creator = msg.sender;
      name = _name;
      termDiscount = _termDiscount;
      totalCoupon = _initialSupply;
      totalFreeCoupon = _initialSupply;
    }

}
