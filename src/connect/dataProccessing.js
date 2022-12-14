import { ethers } from "ethers"

import { factoryABI, saleABI, adminABI, testABI } from "./abi"
import moment from "moment"
import { formatEther } from "ethers/lib/utils"
import api from 'connect/BaseApi'

// const backendURL = 'http://localhost:3005/sale'
const backendURL = 'https://sparklaunch-backend.herokuapp.com/sale'

let ADMIN_ADDRESS = localStorage.getItem('ADMIN_ADDRESS') || '0x45B1379Be4A4f389B67D7Ad41dB5222f7104D26C'
let FACTORY_ADDRESS = localStorage.getItem('FACTORY_ADDRESS') || '0x863B229F7d5e41D76C49bC9922983B0c3a096CDF'
let defaultProvider = ethers.getDefaultProvider('https://preseed-testnet-1.roburna.com/')

//let provider = JSON.parse(localStorage.getItem('provider')) || defaultProvider
//let provider = new ethers.providers.Web3Provider(window.ethereum);
let provider = defaultProvider
console.log(ADMIN_ADDRESS, '\n', FACTORY_ADDRESS, "\n", provider)

const FactoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
const AdminContract = new ethers.Contract(ADMIN_ADDRESS, adminABI, provider)

const { ethereum } = window;

//ethereum event reload on chain change
if (ethereum) {
  ethereum.on('chainChanged', () => {
    window.location.reload(false)
  })
}
// ________________________________________________________________________________________________________
// Display functions
// ________________________________________________________________________________________________________
export const checkMetamaskAvailability = async (sethaveMetamask, setIsConnected, setAccountAddress) => {

  if (!ethereum) {
    sethaveMetamask(false);
    console.log('MetaMask not Installed')
  } else {
    console.log('MetaMask Installed')
    sethaveMetamask(true);
    //display address if Meta installed and connected
    if (ethereum.selectedAddress) {
      setIsConnected(true)
      setAccountAddress(ethereum.selectedAddress)
      //provider = new ethers.providers.Web3Provider(window.ethereum);
    }
  }
}

export const connectWallet = async (haveMetamask, setIsConnected, setAccountAddress) => {
  try {

    if (haveMetamask) {

      provider = new ethers.providers.Web3Provider(window.ethereum);
      setAccountAddress(ethereum.selectedAddress);
      setIsConnected(true);

    }
    else {
      console.log("Metamask not installed")
      alert('Please install Metamask')
    }

  }
  catch (error) {
    setIsConnected(false);
    console.log(error)
    alert(error.message)
  }
}

export const handleChange = async (haveMetamask, item, setSelected, setIsLoading) => {

  setSelected(item)

  if (haveMetamask) {

    const chainId = await ethereum.request({ method: 'eth_chainId' });

    if (chainId === item.value) {
      alert("You are on the correct network")
    }
    else {

      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: item.value }],
        });
        console.log("You have succefully switched Network")
      }
      catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          console.log("This network is not available in your metamask, please add it")
        }
        console.log(switchError.msg)
      }
    }
  }

  else {
    console.log('No wallet installed')
  }

  if (item.text === 'Binance Smart') {
    ADMIN_ADDRESS = '0xE765240958a91DF0cF878b8a4ED23D5FF8effFFe'
    FACTORY_ADDRESS = '0x863CC01CDC295A1042b8A734E61D9be280C47F2a'
    provider = ethers.getDefaultProvider('https://data-seed-prebsc-1-s1.binance.org:8545')
    getAllSales(setIsLoading)
    localStorage.setItem('ADMIN_ADDRESS', ADMIN_ADDRESS)
    localStorage.setItem('FACTORY_ADDRESS', FACTORY_ADDRESS)
    localStorage.setItem('provider', JSON.stringify(provider))

  }

  else if (item.text === 'Roburna Chain') {
    ADMIN_ADDRESS = '0x45B1379Be4A4f389B67D7Ad41dB5222f7104D26C'
    FACTORY_ADDRESS = '0x863B229F7d5e41D76C49bC9922983B0c3a096CDF'
    provider = ethers.getDefaultProvider('https://preseed-testnet-1.roburna.com/')
    getAllSales(setIsLoading)
    localStorage.setItem('ADMIN_ADDRESS', ADMIN_ADDRESS)
    localStorage.setItem('FACTORY_ADDRESS', FACTORY_ADDRESS)
    localStorage.setItem('provider', JSON.stringify(provider))
  }

  localStorage.setItem('selectedChain', JSON.stringify(item))
  //window.location.reload()

}

export const fetchFeaturedSale = (setFeaturedSales) => {
  api.get("featured/true", {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  })
    .then(response => {
      const data = response.data
      // console.log(data)

      setFeaturedSales(data)
    })
    .catch(error => {
      // information not found
      console.log(error.response?.data?.message)
    })
}

export const formatDeployedSales = async (sales) => {

  let formatedSales = []


  await sales.forEach(async (sale) => {
    const saleAddress = await FactoryContract.saleIdToAddress(sale._id)
    console.log(saleAddress)
    if (saleAddress !== '0x0000000000000000000000000000000000000000') {
      //get sale chainData
      const saleContract = new ethers.Contract(saleAddress, saleABI, provider)

      const chainData = await saleContract.sale()

      const noOfParticipants = await saleContract.numberOfParticipants()
      const holders = await noOfParticipants.toNumber()

      //get max and min participation
      const minBuy = await saleContract.minParticipation()
      const maxBuy = await saleContract.maxParticipation()

      //get sale start, isFinished
      const isFinished = await saleContract.saleFinished()
      const saleStartTime = await saleContract.saleStartTime()

      const percentage = () => {
        const raised = chainData.totalBNBRaised / 10 ** 18
        const hardCap = chainData.hardCap / 10 ** 18
        const price = chainData.tokenPriceInBNB / 10 ** 18

        const value = raised / (hardCap * price) * 100

        return value > 0 ? value : 0
      }

      const timeDiff = () => {
        const diffEnd = moment(chainData.saleEnd.toString() * 1000).fromNow()
        const diffStart = moment(saleStartTime.toNumber() * 1000).fromNow()

        if (isFinished) {
          return 'Sale Closed'
        }
        else if (Date.now() / 1000 < saleStartTime.toNumber()) {
          return 'Sale starts ' + diffStart
        }
        else if (Date.now() / 1000 < chainData.saleEnd.toString()) {
          return 'Sale ends ' + diffEnd
        }
        else {
          return 'Sale ended ' + diffEnd
        }
      }

      const status = () => {
        if (isFinished) {
          return 'CLOSED'
        }
        else if (Date.now() / 1000 < saleStartTime.toNumber()) {
          return 'UPCOMMING'
        }
        else if (Date.now() / 1000 < chainData.saleEnd.toString()) {
          return 'LIVE'
        }
        else if (chainData.saleEnd.toNumber() === 0) {
          return 'NOT-SET'
        }
        else return 'ENDED'

      }

      sale = {
        id: sale._id,
        saleToken: {
          name: sale.saleToken.name,
          symbol: sale.saleToken.symbol,
          address: sale.saleToken.address,
        },
        saleParams: {
          softCap: chainData.softCap.toString() / 10 ** 18,
          hardCap: chainData.hardCap.toString() / 10 ** 18,
          raised: chainData.totalBNBRaised.toString() / 10 ** 18,
          price: chainData.tokenPriceInBNB.toString() / 10 ** 18,
          startDate: sale.saleParams.startDate,
          endDate: new Date(chainData.saleEnd.toString() * 1000),
          minBuy: minBuy.toString() / 10 ** 18,
          maxBuy: maxBuy.toString() / 10 ** 18,
          firstRelease: sale.saleParams.firstRelease,
          eachRelease: sale.saleParams.eachRelease,
          vestingDays: sale.saleParams.vestingDay
        },
        saleLinks: {
          logo: sale.saleLinks.logo,
          fb: sale.saleLinks.fb,
          git: sale.saleLinks.git,
          insta: sale.saleLinks.insta,
          reddit: sale.saleLinks.reddit,

          web: sale.saleLinks.web,
          twitter: sale.saleLinks.twitter,
          telegram: sale.saleLinks.telegram,
          discord: sale.saleLinks.discord,
          youtube: sale.saleLinks.youtube
        },
        saleDetails: {
          saleID: sale.saleDetails.saleID,
          saleAddress: saleAddress,
          saleOwner: chainData.saleOwner.toString(),
          description: sale.saleDetails.description,
          holders: holders,
          listingDate: sale.saleDetails.listingDate,
          percentage: percentage(),
          diff: timeDiff(),
          status: status()
        },
      }

      console.log(sale)
      formatedSales.push(sale)
    }

  })

  console.log(formatedSales)
  return formatedSales


}

const getAllSales = (setIsLoading) => {

  api.get("deployed/true", {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  })
    .then(async response => {
      const data = response.data
      console.log(data)

      let deployedSales = []

      deployedSales = await formatDeployedSales(data)
      console.log(deployedSales)

      setDeployedSales(deployedSales)
      setFilteredSales(deployedSales)


      setTimeout(async () => {
        setIsLoading(false)
      }, 45000);
    })
    .catch(error => {
      // information not found
      console.log(error.message)
    })
}

export const getSaleById = async (id, setIsLoading) => {
  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });

    //fetch data from DB
    const response = await (await fetch(`${backendURL}/${id}`)).json()
    const DBdata = await response[0]
    // console.log('DBdata', DBdata)
    // console.log('Token Name', DBdata.saleToken.name)

    //Fetch data from Blockchain
    const saleAddress = await FactoryContract.saleIdToAddress(id)
    const saleContract = new ethers.Contract(saleAddress, saleABI, provider)
    const chainData = await saleContract.sale()
    // console.log('chainData', chainData)


    //Sale Params (13 fields)
    const saleStartTime = new Date((await saleContract.saleStartTime()).toString() * 1000)
    const saleEndTime = new Date(chainData.saleEnd.toString() * 1000)
    const softCap = chainData.softCap.toString() / 10 ** 18
    const hardCap = chainData.hardCap.toString() / 10 ** 18
    const minBuy = await saleContract.minParticipation() / 10 ** 18
    const maxBuy = await saleContract.maxParticipation() / 10 ** 18
    const tokenAddress = chainData.token.toString()
    const ownerAddress = chainData.saleOwner.toString()
    const tokenPrice = chainData.tokenPriceInBNB / 10 ** 18
    const tokenSold = chainData.totalTokensSold / 10 ** 18
    const BNBRaised = chainData.totalBNBRaised / 10 ** 18
    const publicRoundStartDelta = (await saleContract.publicRoundStartDelta()).toString() * 1000 // toISOString() converts to hrs and minutes
    const noOfHolders = (await saleContract.numberOfParticipants()).toNumber()

    //sale State (true or false, 7 fields)
    const isFinished = await saleContract.saleFinished()
    const isSaleSuccessful = await saleContract.isSaleSuccessful()
    const issaleCancelledTokensWithdrawn = await saleContract.saleCancelledTokensWithdrawn()
    const isCreated = chainData.isCreated
    const isEarningsWithdrawn = chainData.earningsWithdrawn
    const isLeftoverWithdrawn = chainData.leftoverWithdrawn
    const isTokensDeposited = chainData.tokensDeposited

    //Sale Rounds 
    const round1 = new Date((await saleContract.tierIdToTierStartTime(1)).toString() * 1000)
    const round2 = new Date((await saleContract.tierIdToTierStartTime(2)).toString() * 1000)
    const round3 = new Date((await saleContract.tierIdToTierStartTime(3)).toString() * 1000)
    const round4 = new Date((await saleContract.tierIdToTierStartTime(4)).toString() * 1000)
    const round5 = new Date((await saleContract.tierIdToTierStartTime(5)).toString() * 1000)
    const publicRound = new Date((await saleContract.tierIdToTierStartTime(5)).toString() * 1000 + publicRoundStartDelta)

    //Derived fileds 
    const percentage = () => {
      const value = BNBRaised / (hardCap * tokenPrice) * 100
      if (value > 0) { return value } else { return 0 }
    }

    const timeDiff = () => {
      const diffEnd = moment(saleEndTime).fromNow()
      const diffStart = moment(saleStartTime).fromNow()
      if (isFinished) {
        return 'Sale Closed'
      } else if (Date.now() < saleStartTime) {
        return 'Sale starts ' + diffStart
      } else if (Date.now() < saleEndTime) {
        return 'Sale ends ' + diffEnd
      } else {
        return 'Sale ended ' + diffEnd
      }
    }

    const status = () => {
      if (isFinished) {
        return 'CLOSED'
      } else if (Date.now() < saleStartTime) {
        return 'UPCOMMING'
      } else if (Date.now() < saleEndTime) {
        return 'LIVE'
      } else if (saleEndTime === 0) {
        return 'NOT-SET'
      } else return 'ENDED'

    }

    const user = async () => {
      if (await AdminContract.isAdmin(ethereum.selectedAddress)) {
        return 'admin'
      } else if (ownerAddress.toLowerCase() === ethereum.selectedAddress.toLowerCase()) {
        return 'seller'
      } else {
        return 'buyer'
      }
    }

    const type = () => {
      console.log(round1.getTime())
      if (round1.getTime() === 0) { return 'Not set' }
      else if (Date.now() > saleStartTime && Date.now() < publicRound) { return 'Private' }
      else if (Date.now() > publicRound) { return 'Public' }

    }

    const round = () => {
      if (round1.getTime() === 0) { return 'Not set' }
      else if (Date.now() < saleStartTime) { return 'Yet to start' }
      else if (Date.now() > saleStartTime && Date.now() < round1) {
        return `ONE starts ${moment(round1).fromNow()}`
      }
      else if (Date.now() > round1 && Date.now() < round2) { return ' ONE' }
      else if (Date.now() > round2 && Date.now() < round3) { return ' TWO' }
      else if (Date.now() > round3 && Date.now() < round4) { return ' THREE' }
      else if (Date.now() > round4 && Date.now() < round5) { return ' FOUR' }
      else if (Date.now() > round5 && Date.now() < publicRound) {
        return ' FIVE, ' + 'PUBLIC starts ' + moment(publicRound).fromNow()
      }
      else if (Date.now() > publicRound) { return 'PUBLIC' }
    }

    let saleDBChain = {
      id: DBdata._id,
      user: await user(),
      saleToken: {
        name: DBdata.saleToken.name,
        symbol: DBdata.saleToken.symbol,
        address: tokenAddress,
      },
      saleParams: {
        startDate: saleStartTime,
        endDate: saleEndTime,
        softCap: softCap,
        hardCap: hardCap,
        minBuy: minBuy,
        maxBuy: maxBuy,
        saleAddress: saleAddress,
        saleOwner: ownerAddress,
        raised: BNBRaised,
        price: tokenPrice,
        sold: tokenSold,
        publicRoundStartDelta: publicRoundStartDelta,
        holders: noOfHolders
      },
      saleRouds: {
        round1: round1,
        round2: round2,
        round3: round3,
        round4: round4,
        round5: round5,
        publicRound: publicRound
      },
      saleLinks: {
        logo: DBdata.saleLinks.logo,
        fb: DBdata.saleLinks.fb,
        git: DBdata.saleLinks.git,
        insta: DBdata.saleLinks.insta,
        reddit: DBdata.saleLinks.reddit,

        web: DBdata.saleLinks.web,
        twitter: DBdata.saleLinks.twitter,
        telegram: DBdata.saleLinks.telegram,
        discord: DBdata.saleLinks.discord,
        youtube: DBdata.saleLinks.youtube
      },
      saleState: {
        isFinished: isFinished,
        isSuccessful: isSaleSuccessful,
        isCancelled: issaleCancelledTokensWithdrawn,
        isCreated: isCreated,
        isEarningsWithdrawn: isEarningsWithdrawn,
        isLeftoverWithdrawn: isLeftoverWithdrawn,
        isTokensDeposited: isTokensDeposited
      },
      saleDetails: {
        saleID: DBdata.saleDetails.saleID,
        description: DBdata.saleDetails.description,
        listingDate: DBdata.saleDetails.listingDate,
        percentage: percentage(),
        diff: timeDiff(),
        status: status(),
        access: type(),
        round: round()
      },
    }

    setIsLoading(false)

    // console.log("SaleChainDB:", saleDBChain)
    return saleDBChain

  }
  catch (error) {
    console.log(error.message)
    return null
  }
}

export const getDeploymentFee = async () => {
  const deploymentFee = formatEther(await FactoryContract.fee())
  console.log('deploymentFee', deploymentFee)

  return deploymentFee

}
//____________________________________________________________________________________________________________
//  Seller operations
// ___________________________________________________________________________________________________________
export const depositTokens = async (selectedSale, setIsProcessing) => {
  try {

    setIsProcessing(true)

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });


    if (selectedSale === 0) {
      console.log('selected sale lost, please refresh')
    } else {
      //get sale address
      const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);

      //Create signer
      const signer = provider.getSigner(ethereum.selectedAddress)

      //get connect to sale contract
      const saleContract = new ethers.Contract(saleAddress, saleABI, signer)
      //get address to token of sale
      const tokenAddress = (await saleContract.sale()).token
      //console.log('Sale Token Address', tokenAddress)
      const BUSDContract = new ethers.Contract(tokenAddress, testABI, signer)

      //get sale details
      const sale = await saleContract.sale()
      //compare address
      const compare = sale.saleOwner.toString().toLowerCase() === ethereum.selectedAddress.toString().toLowerCase()
      // console.log('compare', compare)

      //check balance
      const bal = (await BUSDContract.balanceOf(ethereum.selectedAddress)) / 10 ** 18
      const hardCap = (sale.hardCap) / 10 ** 18
      console.log('bal:', bal, 'hardcap', hardCap)

      if (!sale.isCreated) {
        console.log('params not set')
        alert('params not set')
      } else if (!compare) {
        console.log('Not sale owner')
        alert('You are not the sale Owner')
      } else if (sale.tokensDeposited) {
        console.log("Already deposited")
        alert('Tokens aready Deposited')
      } else if (bal < hardCap) {
        console.log("Insufficient tokens")
        alert(`You need ${hardCap - bal} Tokens to complete this transaction`)
      }
      else {
        const approve = await BUSDContract.approve(saleAddress, sale.hardCap)
        await approve.wait()
        console.log("Approve", approve)

        if (approve) {
          const deposit = await saleContract.depositTokens()
          await deposit.wait()
          console.log('deposit:', deposit)
        }
      }
      setIsProcessing(false)
    }

  } catch (error) {
    console.log(error.message)
  }
}

export const withdrawDeposit = async (selectedSale, setIsProcessing) => {
  setIsProcessing(true)
  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });


    if (selectedSale === 0) {
      console.log('selected sale lost, please refresh')
      alert('selected sale lost, please refresh')
    } else {
      //get sale address
      const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);

      //Create signer
      const signer = provider.getSigner(ethereum.selectedAddress)

      //get connect to contract
      const saleContract = new ethers.Contract(saleAddress, saleABI, signer)

      //get sale details
      const sale = await saleContract.sale()


      const compare = sale.saleOwner.toString().toLowerCase() === ethereum.selectedAddress.toString().toLowerCase()
      // console.log('compare', compare)

      if (!sale.isCreated) {
        console.log('params not set')
        alert('params not set')
      } else if (!compare) {
        console.log('Not sale owner')
        alert('Not sale owner')
      } else if (!await saleContract.saleFinished()) {
        console.log("Sale not finished")
        alert("Sale not finished")
      } else if (await saleContract.isSaleSuccessful()) {
        console.log("sale was successful, withdraw earning instead")
        alert("sale was successful, withdraw earning instead")
      } else {
        const tx = await saleContract.withdrawDepositedTokensIfSaleCancelled()
        await tx.wait()
        console.log('tx:', tx)
        alert('Withdrawn Successfully')
      }
    }

  } catch (error) {
    console.log(error.message)
  }
  setIsProcessing(false)
}

export const withdrawEarnings = async (selectedSale, setIsProcessing) => {
  setIsProcessing(true)
  var errorMsg = document.getElementById('errormsg')
  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });


    if (selectedSale === 0) {
      console.log('selected sale lost, please refresh')
      errorMsg.innerText = 'Selected sale lost, please refresh'
      alert('selected sale lost, please refresh')
    } else {
      //get sale address
      const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);

      //Create signer
      const signer = provider.getSigner(ethereum.selectedAddress)

      //get connect to contract
      const saleContract = new ethers.Contract(saleAddress, saleABI, signer)

      //get sale details
      const sale = await saleContract.sale()

      //compare address
      const compare = sale.saleOwner.toString().toLowerCase() === ethereum.selectedAddress.toString().toLowerCase()
      // console.log('compare', compare)

      if (!sale.isCreated) {
        console.log('params not set')
        alert('params not set')
        errorMsg.innerText = 'params not set'
      } else if (!compare) {
        console.log('Not sale owner')
        alert('Not sale owner')
        errorMsg.innerText = 'Not sale owner'
      } else if (!await saleContract.saleFinished()) {
        console.log('sale still running')
        alert('sale still running')
        errorMsg.innerText = 'sale still running'
      } else if (! await saleContract.isSaleSuccessful()) {
        console.log("sale was cancled,withdraw deposited instead")
        errorMsg.innerText = 'sale was cancled.Withdraw deposited instead'
        alert('sale was cancled.Withdraw deposited instead')
      } else if (sale.earningsWithdrawn) {
        console.log("Aready withdraw")
        errorMsg.innerText = "Aready withdraw"
        alert("Aready withdraw")
      }
      else {
        const tx = await saleContract.withdrawEarningsAndLeftover()
        await tx.wait()
        console.log('tx:', tx)
        alert("Withdraw earning successful!")
      }
    }

  } catch (error) {
    console.log(error.message)
  }
  setIsProcessing(false)
}

export const saveData = async (values) => {

  try {

    if (values.maxbuy < values.minbuy) {
      alert("maxBuy is less than minBuy")
    }

    else {

      const input = JSON.stringify(
        {

          saleToken:
          {
            name: values.title,
            symbol: values.symbol,
            address: values.address
          },
          saleParams:
          {
            softCap: values.softcap,
            hardCap: values.hardcap,
            minBuy: values.minbuy,
            maxBuy: values.maxbuy,
            startDate: values.startdt,
            endDate: values.enddt,
            price: values.price,
            saleOwner: values.saleOwner ? values.saleOwner : ethereum.selectedAddress,
            round1: values.round1,
            round2: values.round2,
            round3: values.round3,
            round4: values.round4,
            round5: values.round5,
            publicroundDelta: values.publicroundDelta,

          },

          saleLinks: {
            logo: values.logo,
            fb: values.facebook,
            git: values.githube,
            insta: values.instagram,
            reddit: values.reddit,
            web: values.website,
            twitter: values.twitter,
            telegram: values.telegram,
            discord: values.discord,
            youtube: values.youtube
          },
          saleDetails: {

            description: values.description,
            whilelist: values.whilelist
          },

        }

      )

      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input
      };


      const response = await fetch(`${backendURL}`, requestOptions);
      const data = await response.json();
      // console.log('Data:', data)
      let id = await data._id
      let softCap = data.saleParams.softCap
      let hardCap = data.saleParams.hardCap
      let minBuy = data.saleParams.minBuy
      let maxBuy = data.saleParams.maxBuy

      // console.log('SaveData:', 'ID:', id, 'softCap', softCap, 'hardcap', hardCap, 'Minbuy', minBuy, 'Maxbuy', maxBuy)

      return { id, minBuy, maxBuy }

    }

  } catch (e) { console.log("Err: ", e.message) }

  //console.log(data)
}

export const deploySale = async (values) => {

  try {

    if (!ethereum) {
      console.log('Please install MetaMask')
      alert('Please install MetaMask')
    }

    else {

      const connect = await ethereum.request({ method: 'eth_requestAccounts' });

      if (connect) {
        const { id, minBuy, maxBuy } = await saveData(values)
        // console.log('deploySale:', id, minBuy, maxBuy)

        //signer needed for transaction (use current connected address)
        const signer = provider.getSigner();

        const FactoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, signer);

        let balance = await provider.getBalance(ethereum.selectedAddress);
        let bal = ethers.utils.formatEther(balance);

        let deployFee = await FactoryContract.fee()
        let fee = ethers.utils.formatEther(deployFee)

        if (bal < fee) {

          // console.log("insufficient funds")
          alert("insufficient funds")
        }
        else {

          const tx = await FactoryContract.deployNormalSale(
            ethers.utils.parseUnits(minBuy.toString(), 'ether'),
            ethers.utils.parseUnits(maxBuy.toString(), 'ether'),
            id,
            { value: deployFee })

          await tx.wait()
          // console.log('success')


          let saleAddress = await FactoryContract.saleIdToAddress(id)
          // console.log('SaleAddress:', saleAddress)

          if (saleAddress) {

            const input = JSON.stringify(
              {
                deployed: true,
                saleAddress: saleAddress

              }
            )

            const requestOptions = {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: input
            };

            const response = await fetch(`${backendURL}/deploy/${id}`, requestOptions)
            const data = await response.json()

            // console.log("data aft put", data)

            // console.log('Account:', ethereum.selectedAddress)
            // console.log("Bal4:", bal)
            // console.log('fee:', fee)
            const BalAFT = await provider.getBalance(ethereum.selectedAddress)
            // console.log('BalAFT:', formatEther(BalAFT))

            window.location.pathname = '/'

          }
        }
      }
    }
  }
  catch (error) { console.log("Error:", error.message) }
}

// ______________________________________________________________________________________________________________
//   Buyer operations
//_______________________________________________________________________________________________________________

export const participateInsale = async (selectedSale, amount, closeParticipation) => {

  const amountInWei = ethers.utils.parseUnits(amount.toString(), 'ether')

  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });

    //get sale address
    const saleAddressObject = await FactoryContract.saleIdToAddress(selectedSale);
    const saleAddress = saleAddressObject.toString()

    //get sale chainData
    const signer = provider.getSigner(ethereum.selectedAddress)
    const saleContract = new ethers.Contract(saleAddress, saleABI, signer);
    const sale = await await saleContract.sale()
    console.log('Is sale params Set', sale.isCreated)

    //get user tier
    const userTier = (await saleContract.tier(ethereum.selectedAddress)).toNumber();
    console.log('userTier', userTier)

    //get publicRound
    const round5 = await saleContract.tierIdToTierStartTime(5).toString() * 1000
    const delta = await saleContract.publicRoundStartDelta().toString() * 1000
    const publicRound = new Date(round5 + delta)

    //get max and min
    const max = (await saleContract.maxParticipation()).toString() / 10 ** 18
    const min = (await saleContract.minParticipation()).toString() / 10 ** 18
    console.log('max: ', max, 'min: ', min)

    if (await saleContract.isParticipated(ethereum.selectedAddress)) {
      console.log('Already Participated')
      alert('Already Participated')


    }

    else if (!sale.isCreated) {
      console.log('sale Params not set')
      alert('sale Params not set')

    }

    else if (!sale.tokensDeposited) {
      console.log('Sale tokens were not deposited')
      alert('Sale tokens were not deposited')

    }

    else if (userTier === 0 && Date.now() < publicRound) {
      console.log('No tier granted')
      alert('No tier granted')
    }

    else if (Date.now() < new Date((await saleContract.tierIdToTierStartTime(userTier)).toString() * 1000)) {
      console.log(`Wrong round.Your rounds is ${userTier}`)
      alert(`Wrong round.Your rounds is ${userTier}`)
    }

    else if (amount < min) {
      alert(`Minmun amount is ${min}`)
    }

    else if (amount > max) {
      alert(`Maxmun amount is ${max}`)
    }


    else {
      //Participate
      const tx = await saleContract.participate(userTier, { value: amountInWei })
      await tx.wait()
      console.log(tx)
      console.log('Participation Successfull')

    }

    closeParticipation()

  } catch (error) {
    console.log(error.message)
  }
}

export const withdraw = async (selectedSale, setIsProcessing) => {
  setIsProcessing(true)
  try {


    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });

    //get sale address
    const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);

    //get sale chainData
    const signer = provider.getSigner(ethereum.selectedAddress)
    const saleContract = new ethers.Contract(saleAddress, saleABI, signer)
    const sale = await saleContract.sale()
    if (!sale.isCreated) {
      console.log('params not set')
      alert('params not set')
    } else if (!await saleContract.saleFinished()) {
      console.log("Sale not Finished")
      alert("Sale not Finished")
    } else if (! await saleContract.isParticipated(ethereum.selectedAddress)) {
      console.log('You did not participate')
      alert("You did not participate")
    } else if (!await saleContract.isSaleSuccessful()) {
      console.log("sale Not successful,withdraw unused instead")
      alert("sale Not successful,withdraw unused instead")
    } else {
      const tx = await saleContract.withdraw()
      tx.wait(1)
      console.log('tx:', tx)
      alert("Withdraw successful")
    }


  } catch (error) {
    console.log(error.message)
  }
  setIsProcessing(false)

}

export const withdrawUnused = async (selectedSale, setIsProcessing) => {
  try {

    setIsProcessing(true)
    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });

    //get sale address
    const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);

    // create signer
    const signer = provider.getSigner(ethereum.selectedAddress)

    //connect to sale
    const saleContract = new ethers.Contract(saleAddress, saleABI, signer)

    //get sale chain data
    const sale = await saleContract.sale()

    if (!sale.isCreated) {
      console.log('params not set')
      alert('Params not set')
    } else if (!await saleContract.saleFinished()) {
      console.log("Sale not Finished")
      alert("Sale not Finshed")
    } else if (! await saleContract.isParticipated(ethereum.selectedAddress)) {
      console.log('You did not participate')
      alert("You did not Participate")
    } else if (await saleContract.isSaleSuccessful()) {
      console.log("sale was successful, withdraw instead")
      alert("sale was successful, withdraw instead")
    } else {
      const tx = await saleContract.withdrawUserFundsIfSaleCancelled()
      await tx.wait()
      console.log('tx:', tx)
      alert('Withdraw successful!')
    }

    setIsProcessing(false)

  } catch (error) {
    console.log(error.message)
  }
}
// _________________________________________________________________________________________________________________
// Admin operations
// _________________________________________________________________________________________________________________
export const finishSale = async (selectedSale, setIsProcessing) => {

  try {
    setIsProcessing(true)
    //get sale signer
    const signer = provider.getSigner(ethereum.selectedAddress)

    //get sale address
    const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);
    const saleContract = new ethers.Contract(saleAddress, saleABI, signer)

    //get sale data
    const sale = await saleContract.sale()
    const saleEnd = new Date(sale.saleEnd.toString() * 1000)

    if (await saleContract.saleFinished()) {
      console.log('sale aready Finished')
      alert('sale aready Finished')

    } else if (!await AdminContract.isAdmin(ethereum.selectedAddress)) {
      console.log('Caller not the admin')
      alert('Caller not the Admin')

    } else if (Date.now() < saleEnd) {
      console.log('Sale end time is yet')
      alert('Sale end time is yet')

    } else {
      //finish sale
      const tx = await saleContract.finishSale()
      await tx.wait()
      console.log('tx:', tx)
      alert('Sale finished Successfully')
    }
    setIsProcessing(false)
  } catch (error) {
    console.log('Error:', error.message)
  }
  setIsProcessing(false)
}

