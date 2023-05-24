# FundContract

## Installation

## Deploy
Deployment can be done in several ways:<br>
1. Through the [intercoin factory mechanism](https://github.com/Intercoin/IntercoinContract).
2. Deploy FundFactory before and call the method `produce`.
3. Deploy FundContract directly on the network and call the method [init](#init).

In all cases, parameters need to be specified:<br>

name | type | description | example
--|--|--|--
_sellingToken|address|address of the [ITR token](https://etherscan.io/token/0x6ef5febbd2a56fab23f18a69d3fb9f4e2a70440b) | 0x6Ef5febbD2A56FAb23f18a69d3fB9F4E2A70440B
_timestamps|uint256[] | array of timestamps (GMT) | [1609459200, 1614556800, 1619827200]
_prices|uint256[]| array of prices for the exchange in ETH (multiplied by 1e8) | [12000000, 15000000, 18000000]
_endTime|uint256| the time after which the exchange will be stopped | 1630454400
_thresholds|uint256[]| thresholds of ETH (in wei) that trigger bonuses for group members | [10000000000000000000, 25000000000000000000, 50000000000000000000]
_bonuses|uint256[]| bonuses in percentages (multiplied by 100), e.g., 10%, 20%, 30% or 0.1, 0.2, 0.5 | [10, 20, 50]
_ownerCanWithdraw|enum(never, afterEndTime, anytime)| an option representing the owner's ability to withdraw tokens left in the contract| 1
_whitelistData|{address contractAddress, bytes4 method, uint8 role, bool useWhitelist;}| settings for the whitelist. The exchange can only be accessed by whitelisted individuals. For more information, see the [Intercoin/Whitelist](https://github.com/Intercoin/Whitelist) repository. In example "internal whitelist"| [0x0000000000000000000000000000000000000000,0x95a8c58d,0x4,true]

# Overview
Once installed, methods can be used for exchange.

## Methods

| Method Name | Called By | Description |
|---|---|---|
| [getConfig](#getconfig) | Anyone | Retrieves data with which the contract was initialized. |
| [receive](#receive) | Anyone | An internal method triggered when the contract receives ETH. It exchanges ETH for tokens. |
| [getGroupBonus](#getgroupbonus) | Anyone | Retrieves the current group bonus. |
| [getTokenPrice](#gettokenprice) | Anyone | Retrieves the current token price. |
| [withdraw](#withdraw) | Owner | Withdraws a specified amount of tokens to a given address. |
| [withdrawAll](#withdrawall) | Owner | Withdraws all tokens to the owner (sender). |
| [claim](#claim) | Owner | Claims a specified amount of ETH to a given address. |
| [claimAll](#claimall) | Owner | Claims all ETH to the owner (sender). |
| [setGroup](#setgroup) | Owner | Links participants to a group. |

### getConfig

Returns the parameters with which the contract was initialized.

### getGroupBonus

Parameters:
name  | type | description
--|--|--
groupName|string| The name of the group.

Returns the group bonus as a `uint`.

### getTokenPrice

Returns the token price as a `uint`.

### withdraw

Parameters:
name  | type | description
--|--|--
amount|uint256| The amount of tokens to withdraw.
addr|address| The address to send the tokens to.

### withdrawAll

Withdraws all tokens to the owner.

### claim

Parameters:
name  | type | description
--|--|--
amount|uint256| The amount of tokens to claim.
addr|address| The address to send the tokens to.

### claimAll

Claims all ETH to the owner (sender).

### setGroup

Parameters:
name  | type | description
--|--|--
addresses|address[]| The addresses that need to be linked with the group.
groupName|string| The name of the group. If the group doesn't exist, it will be created.

# Example

1. Deploy the contract (through the [intercoin factory mechanism](https://github.com/Intercoin/IntercoinContract)).
2. Transfer some `sellingToken` to the contract.
3. Now, any user who sends ETH to the contract will be able to receive `sellingToken` until the `endTime` expires or the contract has enough tokens to return.
4. If the owner adds a user to a group (by calling the [setGroup](#setgroup) method) and the group reaches the threshold, all group members will receive bonus tokens.
5. Additionally, if a user acquires tokens without being in a group and then becomes a member of any group, all the contributed tokens will be part of the group and increase the group bonus.

## How Bonuses Work

We have created a contract that sends additional tokens to a group of people who contribute more than the specified thresholds. For example:<br>
After 10 ETH - 10% bonus<br>
After 25 ETH - 20% bonus<br>
After 50 ETH - 50% bonus<br>
So the initial parameters will be:<br>
thresholds = [10_000000000000000000, 25_000000000000000000, 50_000000000000000000]<br>
bonuses = [10, 20, 50]<br>
Here, the thresholds are set in wei and the bonuses are multiplied by 100.<br>
<br>
For a better understanding of the math, let's take the variable `price_ETH_TOKEN = 10000000` (0.5 ETH = 1 ITR).

<details>
<summary>look at the table below</summary>
<table>
<head>
<tr>
<td rowspan="2"></td>
<td rowspan="2">action</td>
<td rowspan="2">person</td>
<td colspan="2">total contributed,<br>ETH</td>
<td colspan="2">bonus tokens contributed,<br>ITR</td>
<td colspan="2">got by transaction,<br>ITR</td>
<td>Total balance,<br>ITR</td>
<td colspan="2">"BestGroup" Total,<br>ETH</td>
<td colspan="2">"BestGroup#2" Bonus,<br>%</td>
</tr>
<tr>
<td>old</td>
<td>new</td>
<td>old</td>
<td>new</td>
<td>main</td>
<td>bonus</td>
<td></td>
<td>Total,<br>ETH</td>
<td>Bonus,<br>%</td>
<td>Total,<br>ETH</td>
<td>Bonus,<br>%</td>
</tr>
</head>
<body>
<tr>
<td>1</td>	
<td colspan="9">
Setup the same group "BestGroup"(<a href="#setgroup">setGroup</a>) for Person#1,Person#2
</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
</tr>
<tr>
<td rowspan="4">2</td>	
<td rowspan="4">Person#1 contributed $5,000</td>
<td>Person#1</td>
<td>0</td>
<td>5.0</td>
<td>0.0</td>
<td>0.0</td>
<td>10.0</td>
<td>0.0</td>	
<td>10.0</td>	
<td rowspan="4">5.0</td>
<td rowspan="4">0.0</td>
<td rowspan="4">0.0</td>
<td rowspan="4">0.0</td>
</tr>
<tr>
<td>Person#2</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td rowspan="4">3</td>	
<td rowspan="4">Person#1 contributed $7,000</td>
<td>Person#1</td>
<td>5.0</td>
<td>12.0</td>
<td>0.0</td>
<td>2.4</td>
<td>14.0</td>
<td>2.4</td>	
<td>26.4</td>	
<td rowspan="4">12.0</td>
<td rowspan="4">10.0</td>
<td rowspan="4">0.0</td>
<td rowspan="4">0.0</td>
</tr>
<tr>
<td>Person#2</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td rowspan="4">4</td>	
<td rowspan="4">Person#2 contributed 25 ETH</td>
<td>Person#1</td>
<td>12.0</td>
<td>12.0</td>
<td>2.4</td>
<td>4.8</td>
<td>0.0</td>	
<td>2.4</td>
<td>28.8</td>	
<td rowspan="4">37.0</td>
<td rowspan="4">20.0</td>
<td rowspan="4">0.0</td>
<td rowspan="4">0.0</td>
</tr>
<tr>
<td>Person#2</td>
<td>0.0</td>
<td>25.0</td>
<td>0.0</td>
<td>10.0</td>
<td>50.0</td>
<td>10.0</td>	
<td>60.0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td>5</td>	
<td colspan="9">
Setup the same group "BestGroup"(<a href="#setgroup">setGroup</a>) for Person#3
</td>
<td>37.0</td>
<td>20.0</td>
<td>0.0</td>
<td>0.0</td>
</tr>
<tr>
<td rowspan="4">6</td>	
<td rowspan="4">Person#3 contributed $25,000</td>
<td>Person#1</td>
<td>12.0</td>
<td>12.0</td>
<td>4.8</td>
<td>12.0</td>
<td>0.0</td>	
<td>7.2</td>
<td>36.0</td>	
<td rowspan="4">62.0</td>
<td rowspan="4">50.0</td>
<td rowspan="4">0.0</td>
<td rowspan="4">0.0</td>
</tr>
<tr>
<td>Person#2</td>
<td>25.0</td>
<td>25.0</td>
<td>10.0</td>
<td>25.0</td>
<td>0.0</td>
<td>15.0</td>	
<td>75.0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0.0</td>
<td>25.0</td>
<td>0.0</td>
<td>25.0</td>
<td>50.0</td>
<td>25.0</td>	
<td>75.0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>0.0</td>
</tr>
<tr>
<td rowspan="4">7</td>	
<td rowspan="4">Person#4 without any group  contributed 25 ETH </td>
<td>Person#1</td>
<td>12.0</td>
<td>12.0</td>
<td>4.8</td>
<td>12.0</td>
<td>0.0</td>	
<td>7.2</td>
<td>36.0</td>	
<td rowspan="4">62.0</td>
<td rowspan="4">50.0</td>
<td rowspan="4">0.0</td>
<td rowspan="4">0.0</td>
</tr>
<tr>
<td>Person#2</td>
<td>25.0</td>
<td>25.0</td>
<td>10.0</td>
<td>25.0</td>
<td>0.0</td>
<td>15.0</td>	
<td>75.0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0.0</td>
<td>25.0</td>
<td>0.0</td>
<td>25.0</td>
<td>50.0</td>
<td>25.0</td>	
<td>75.0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0.0</td>
<td>25.0</td>
<td>0.0</td>
<td>0.0</td>
<td>50.0</td>
<td>0.0</td>	
<td>50.0</td>
</tr>
<tr>
<td>8</td>	
<td colspan="9">
Setup the same group "BestGroup#2"(<a href="#setgroup">setGroup</a>) for Person#4
</td>
<td>62.0</td>
<td>50.0</td>
<td>25.0</td>
<td>20.0</td>
</tr>
<tr>
<td rowspan="4">10</td>	
<td rowspan="4">Finally </td>
<td>Person#1</td>
<td>12.0</td>
<td>12.0</td>
<td>4.8</td>
<td>12.0</td>
<td>0</td>	
<td>7.2</td>
<td>36.0</td>	
<td rowspan="4">62.0</td>
<td rowspan="4">50.0</td>
<td rowspan="4">25.0</td>
<td rowspan="4">20.0</td>
</tr>
<tr>
<td>Person#2</td>
<td>25.0</td>
<td>25.0</td>
<td>10.0</td>
<td>25.0</td>
<td>0.0</td>
<td>15.0</td>	
<td>75.0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0.0</td>
<td>25.0</td>
<td>0.0</td>
<td>25.0</td>
<td>50.0</td>
<td>25.0</td>	
<td>75.0</td>
</tr>
<tr>
<td>Person#4</td>
<td>25.0</td>
<td>25.0</td>
<td>50.0</td>
<td>10.0</td>
<td>0.0</td>
<td>0.0</td>	
<td>60.0</td>
</tr>
</body>	
</table>

</details>

