# The Rouge Project - beta code factory and campaign contracts to be used with the RGE token

WARNING: The Rouge token [RGE] has been audited but not yet the factory. So, please do your own due diligences if you
decide to use this code on a production network (Ethereum mainnet, POA, etc). You may lose your RGE deposit, ETH, POA
and/or any ERC20, ERC721 tokens sent as attachment to a campaign.

WARNING : this is NON AUDITED code. Use on testnet or with extreme caution.

The project use the truffle framework (http://truffleframework.com/)

## Versioning

The project follows Semantic Versioning 2.0.0 : see https://semver.org/

## How to run tests :

### 1. install truffle :

```
  npm install -g truffle
```
### 2. launch the tests

```
  truffle test
```

## Creating a campaign :

1. You should have a minimum of RGE tokens on the Ethereum address creating the campaign (issuer) :

   mim RGE = number of notes to be issued * tare price.

The tare price is now set to be 0.1 RGE (as per the white paper, tare will be raised to 1 RGE as usage of
the network grow).

2. Call the function newCampaign(issuance, deposit)

   issuance = number of notes to be created/issued

   deposit = RGE that you move to the campaign as deposit (should equal or more than mim RGE)

3. Read the introduction on medium :

   https://medium.com/the-rouge-project/getting-started-with-the-rouge-protocol-9a335079e69e

4. Enjoy :)


### Licensed under GNU AFFERO GENERAL PUBLIC LICENSE v3

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
