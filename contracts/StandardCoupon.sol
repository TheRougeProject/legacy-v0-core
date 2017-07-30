/*
    The Rouge Project - Blochain Coupon platform
    Copyright (C) 2017 Valentin D. Guillois <vdg@rouge.network>

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

  WARNING : EXPERIMENTAL and NON AUDITED code.
  only use for tests purpose (on a testnet!)

  This is main contract that encapsule the coupon workflow logic

  User is here wiewed as a single address/account
  (A physical person could have more than 1, to be handled by identity control) 


*/
pragma solidity ^0.4.12;

import "./Coupon.sol";

contract StandardCoupon is Coupon {

  /* 
     todo ? struct Authority to replace issuer in some meta task ..
  */

  enum States { Created, Issued, Expired, Archived }

  States public state = States.Created;

  modifier atState(States _state) {
    require(state == _state);
    _;
  }

  modifier onlyBy(address _account) {
    require(msg.sender == _account);
    _;
  }
  
  /*
    Struct Issuer with in $params ?
      => user approval process contract (from library)
      => coupon terms contract (from library?) 
      => expiration rules contract ...
      issuance is locking RGE futur bying (in eth)
   */

  address issuer; /* Issuer has been set up at the contract creation */

  /* set up some parameters like expiration at issuance ? */
  
  function issue() atState(States.Created) onlyBy(issuer) {
    state = States.Issued;
  }

  uint256 totalFree;
  uint256 totalAcquired = 0;
  uint256 totalRedeemed = 0;
  
  /* ********** ********** ********** */
  /* the acquisition Register (track coupons effectively distributed to Users) */
  
  mapping (address => bool) acquisitionRegister;

  function freeCouponSupply() constant returns (uint256 free) {
    return totalFree;
  }

  function hasCoupon(address _user) constant returns (bool yes) {
    require(_user != issuer); /* SI_10 issuer is excluded for now to simplify tests */
    return acquisitionRegister[_user];
  }

  function distributeCoupon(address _to) atState(States.Issued) private returns (bool success) {
    require(_to != issuer); /* SI_10 issuer is excluded for now to simplify tests */
    require(!hasCoupon(_to));
    if (totalFree > 0) {
      totalFree -= 1;
      totalAcquired += 1;
      acquisitionRegister[_to] = true;
      return true;
    } else {
      return false;
    }
  }

  /* low level transfer of coupon between users =/= high level second market */
  function transfer(address _from, address _to) atState(States.Issued) private {
    require(_to != issuer); /* SI_10 issuer is excluded for now to simplify tests */
    require(hasCoupon(_from));
    acquisitionRegister[_from] = false; /* SI_11 _from == _to doesn't really matter here ... */
    acquisitionRegister[_to] = true;
  }

  /* ********** ********** ********** */
  /* Functions that manage the acquisition process for coupons */
  
  function askForCoupon() atState(States.Issued) returns (bool success) {
    require(msg.sender != issuer); /* SI_10 issuer is excluded for now to simplify tests */
    require(!hasCoupon(msg.sender)); /* duplicate test. remove ? */

    /* TODO send to approval contract => return always ok in these tests */

    return distributeCoupon(msg.sender);
  }

  function giveCoupon(address _to) onlyBy(issuer) atState(States.Issued) returns (bool success) {
    return distributeCoupon(_to);
  }


  /* ********** ********** ********** */
  /* the redemtion Register (track coupons effectively redeemed by Users) */
  
  mapping (address => bool) redemptionRegister;

  function hasRedeemed(address _user) constant returns (bool yes) {
    require(_user != issuer);
    return redemptionRegister[_user];
  }

  function redeemCoupon(address _user) atState(States.Issued) private returns (bool success) {
    require(_user != issuer); /* SI_10 issuer is excluded for now to simplify tests */
    require(hasCoupon(_user));
    require(!hasRedeemed(_user));
    totalRedeemed += 1;
    redemptionRegister[_user] = true;
    return true;
  }

  function useCoupon() atState(States.Issued) returns (bool success) {
    require(msg.sender != issuer); /* SI_10 issuer is excluded for now to simplify tests */

    /* TODO global contract expiration test => if expired change state  */
    
    /* TODO send to checkout contract => return always ok in these tests (could put conditions on pos/target)
       require approval from issuer 
     */

    return redeemCoupon(msg.sender);
  }


  /* todo: self destruct fct by issuer if conditions met */

  
}
