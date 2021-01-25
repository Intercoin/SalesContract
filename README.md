# FundContract

# Installation
## Node
`npm install @openzeppelin/contracts-ethereum-package`

# Deploy
when deploy it is need to pass parameters in to constructor

Params:
name | type | description | example
--|--|--|--
_sellingToken|address|address of <a target="_blank" href="https://etherscan.io/token/0x6ef5febbd2a56fab23f18a69d3fb9f4e2a70440b">ITR token</a> | 0x6Ef5febbD2A56FAb23f18a69d3fB9F4E2A70440B
_chainLink|address| aggregator's address (<a target="_blank" href="https://docs.chain.link/docs/ethereum-addresses">list</a>) | 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
_timestamps|uint256[] | array of timestamps(gmt) | [1609459200, 1614556800, 1619827200]
_prices|uint256[]| array prices exchange in usd (mul by 1e8) | [12000000, 15000000, 18000000]
_endTime|uint256| after this time exchange will be stopped | 1630454400
_thresholds|uint256[]| after group reach threshold (mul by 1e8) of usd, every members will get bonuses | [1000000000000, 2500000000000, 5000000000000]
_bonuses|uint256[]| bonuses in percents (mul by 100) i.e. 10%,20%,30%   or 0.1,0.2,0.5  | [10, 20, 50]

# Overview
once installed will be use methods to exchange

## Methods

<table>
<thead>
	<tr>
		<th>method name</th>
		<th>called by</th>
		<th>description</th>
	</tr>
</thead>
<tbody>
    <tr>
		<td><a href="#getlatestprice">getLatestPrice</a></td>
		<td>anyone</td>
		<td>method return the latest price eth/usd</td>
	</tr>
	<tr>
		<td><a href="#getconfig">getConfig</a></td>
		<td>anyone</td>
		<td>data which contract was initialized</td>
	</tr>
	<tr>
		<td><a href="#receive">receive</a></td>
		<td>anyone</td>
		<td>internal method triggered if contract getting ETH.<br> it will exchange eth to token via ratios ETH/USD and USD/`sellingToken`</td>
	</tr>
	<tr>
		<td><a href="#getgroupbonus">getGroupBonus</a></td>
		<td>anyone</td>
		<td>get current group bonus</td>
	</tr>
    <tr>
		<td><a href="#gettokenprice">getTokenPrice</a></td>
		<td>anyone</td>
		<td>get current token price</td>
	</tr>
    <tr>
		<td><a href="#withdraw">withdraw</a></td>
		<td>owner</td>
		<td>withdraw some tokens to address</td>
	</tr>
	<tr>
		<td><a href="#withdrawall">withdrawAll</a></td>
		<td>owner</td>
		<td>withdraw all tokens to owner(sender)</td>
	</tr>
	<tr>
		<td><a href="#claim">claim</a></td>
		<td>owner</td>
		<td>claim some eth to address</td>
	</tr>
	<tr>
		<td><a href="#claimall">claimAll</a></td>
		<td>owner</td>
		<td>claim all eth to owner(sender)</td>
	</tr>
	<tr>
		<td><a href="#setgroup">setGroup</a></td>
		<td>owner</td>
		<td>link participants to group</td>
	</tr>
</tbody>
</table>


#### getLatestPrice

will return int price

#### getConfig

return params which was initialized via contract

#### getGroupBonus

Params:
name  | type | description
--|--|--
groupName|string| group name

will return uint group bonus

#### getTokenPrice

will return uint token price

#### withdraw
Params:
name  | type | description
--|--|--
amount|uint256|amount of tokens
addr|address|address to send

#### withdrawAll

withdraw all tokens to owner

#### claim
Params:
name  | type | description
--|--|--
amount|uint256|amount of tokens
addr|address|address to send


#### claimAll

claim all eth to owner(sender)

#### setGroup
Params:
name  | type | description
--|--|--
addresses|address[]|addresses which need tolink with group.
groupName|string| group name.  if group doesn't exists it will be created

# Example

* deploy contract (through <a target="_blank" href="https://github.com/Intercoin/IntercoinContract">intercoin factory mechanism</a> )
* transfer to contract some `sellingToken`
* now any user which send eth to contract will be able to get `sellingToken` back
* if owner will add user to group (calling method <a href="#setgroup">setGroup</a>) and group will reach threshold, then all users's group will get some bonus tokens

## How bonuses worked
We create contract than will be send addition tokens for group of people which contributed more some thresholds. For example: 
after $10,000 - 10%
after $25,000 - 20%
after $50,000 - 50%
So initial params will be: 
thresholds = [10000, 25000, 50000]
bonuses = [0.1, 0.2, 0.5]

for understanging math take variable price_USD_TOKEN = 10000000 ( $0.5 = ITR 1 )

look at the table below
<table>
<head>
<tr>
<td rowspan="2"></td>
<td rowspan="2">action</td>
<td rowspan="2">person</td>
<td colspan="2">total contributed,<br>$</td>
<td colspan="2">bonus tokens contributed,<br>ITR</td>
<td colspan="2">got by transaction,<br>ITR</td>
<td>Total balance,<br>ITR</td>
<td> "BestGroup" Total,<br>$</td>
<td>"BestGroup" Bonus,<br>%</td>
</tr>
<tr>
<td>old</td>
<td>new</td>
<td>old</td>
<td>new</td>
<td>main</td>
<td>bonus</td>
<td></td>
<td></td>
<td></td>
</tr>
</head>
<body>
<tr>
<td>1</td>	
<td colspan="9">
Setup the same group "BestGroup"(<a href="#setgroup">setGroup</a>) for Person#1,Person#2
</td>
<td>0</td>
<td>0</td>
</tr>

<tr>
<td rowspan="4">2</td>	
<td rowspan="4">Person#1 contributed $5,000</td>
<td>Person#1</td>
<td>0</td>
<td>5,000</td>
<td>0</td>
<td>0</td>
<td>10,000</td>
<td>0</td>	
<td>10,000</td>	
<td rowspan="4">5,000</td>
<td rowspan="4">0</td>
</tr>
<tr>
<td>Person#2</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>

<tr>
<td rowspan="4">3</td>	
<td rowspan="4">Person#1 contributed $7,000</td>
<td>Person#1</td>
<td>5,000</td>
<td>12,000</td>
<td>0</td>
<td>2,400</td>
<td>14,000</td>
<td>2,400</td>	
<td>26,400</td>	
<td rowspan="4">12,000</td>
<td rowspan="4">10</td>
</tr>
<tr>
<td>Person#2</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>
<tr>
<td>Person#3</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>


<tr>
<td rowspan="4">4</td>	
<td rowspan="4">Person#2 contributed $25,000</td>
<td>Person#1</td>
<td>12,000</td>
<td>12,000</td>
<td>2,400</td>
<td>4,800</td>
<td>0</td>	
<td>2,400</td>
<td>28,800</td>	
<td rowspan="4">37,000</td>
<td rowspan="4">20</td>
</tr>
<tr>
<td>Person#2</td>
<td>0</td>
<td>25,000</td>
<td>0</td>
<td>10,000</td>
<td>50,000</td>
<td>10,000</td>	
<td>60,000</td>
</tr>
<tr>
<td>Person#3</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>
<tr>
<td>Person#4</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>

<tr>
<td>5</td>	
<td colspan="9">
Setup the same group "BestGroup"(<a href="#setgroup">setGroup</a>) for Person#3
</td>
<td>37,000</td>
<td>20</td>
</tr>

<tr>
<td rowspan="4">6</td>	
<td rowspan="4">Person#3 contributed $25,000</td>
<td>Person#1</td>
<td>12,000</td>
<td>12,000</td>
<td>4,800</td>
<td>12,000</td>
<td>0</td>	
<td>7,200</td>
<td>36,000</td>	
<td rowspan="4">62,000</td>
<td rowspan="4">50</td>
</tr>
<tr>
<td>Person#2</td>
<td>25,000</td>
<td>25,000</td>
<td>10,000</td>
<td>25,000</td>
<td>0</td>
<td>15,000</td>	
<td>75,000</td>
</tr>
<tr>
<td>Person#3</td>
<td>0</td>
<td>25,000</td>
<td>0</td>
<td>25,000</td>
<td>50,000</td>
<td>25,000</td>	
<td>75,000</td>
</tr>
<tr>
<td>Person#4</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>	
<td>0</td>
</tr>

<tr>
<td rowspan="4">7</td>	
<td rowspan="4">Person#4 without any group  contributed $25,000</td>
<td>Person#1</td>
<td>12,000</td>
<td>12,000</td>
<td>4,800</td>
<td>12,000</td>
<td>0</td>	
<td>7,200</td>
<td>36,000</td>	
<td rowspan="4">62,000</td>
<td rowspan="4">50</td>
</tr>
<tr>
<td>Person#2</td>
<td>25,000</td>
<td>25,000</td>
<td>10,000</td>
<td>25,000</td>
<td>0</td>
<td>15,000</td>	
<td>75,000</td>
</tr>
<tr>
<td>Person#3</td>
<td>0</td>
<td>25,000</td>
<td>0</td>
<td>25,000</td>
<td>50,000</td>
<td>25,000</td>	
<td>75,000</td>
</tr>
<tr>
<td>Person#4</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>50,000</td>
<td>0</td>	
<td>50,000</td>
</tr>

</body>	
</table>