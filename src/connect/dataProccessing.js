import { ethers } from "ethers"

import { factoryABI, saleABI, adminABI, testABI } from "./abi";
// import { selectedSale } from "components/salecards";
import moment from "moment";
import { formatEther } from "ethers/lib/utils";

import api from 'connect/BaseApi'

const backendURL = 'http://localhost:3005/sale'
//const backendURL = 'https://sparklaunch-backend.herokuapp.com/sale'

const ADMIN_ADDRESS = '0x45B1379Be4A4f389B67D7Ad41dB5222f7104D26C'
const FACTORY_ADDRESS = '0x863B229F7d5e41D76C49bC9922983B0c3a096CDF'

const { ethereum } = window;
export let provider

if (!ethereum) {
  console.log('Install MetaMask')
  alert("Please install Metamask")
}
else {
  provider = new ethers.providers.Web3Provider(window.ethereum);
}

const FactoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
const AdminContract = new ethers.Contract(ADMIN_ADDRESS, adminABI, provider)


export const fetchAllSales = async (setIsLoading) => {
  let salesData = [];
  try {

    const salesNO = await FactoryContract.getNumberOfSalesDeployed()

    if (salesNO.toNumber() === 0) {
      console.log('No sale deployed')
    } else {
      const response = await fetch(`${backendURL}/deployed/true`);
      const DBdata = await response.json();
      // console.log('DB Data:', DBdata)

      await DBdata.map(async sale => {

        const saleID = await sale._id

        //get sale address
        const saleAddressObject = await FactoryContract.saleIdToAddress(saleID);
        const saleAddress = saleAddressObject.toString()
        //console.log(saleAddress)

        if (saleAddress === '0x0000000000000000000000000000000000000000') { console.log('sale in DB but not deployed') }
        else {
          //get sale chainData
          const saleContract = new ethers.Contract(saleAddress, saleABI, provider);
          const chainData = await saleContract.sale();
          //console.log('Data',chainData)

          //get NO of participants
          const noOfParticipants = await saleContract.numberOfParticipants()
          const holders = noOfParticipants.toNumber()
          //console.log('Holders', holders)

          //format data for display
          let dateObject = new Date(chainData.saleEnd.toString() * 1000)

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
            if (value > 0) { return value } else { return 0 }
          }

          //const end = chainData.saleEnd.toString()*1000
          const timeDiff = () => {
            const diffEnd = moment(chainData.saleEnd.toString() * 1000).fromNow()
            const diffStart = moment(saleStartTime.toNumber() * 1000).fromNow()
            if (isFinished) {
              return 'Sale Closed'
            } else if (Date.now() / 1000 < saleStartTime.toNumber()) {
              return 'Sale starts in ' + diffStart
            } else if (Date.now() / 1000 < chainData.saleEnd.toString()) {
              return 'Sale ends in ' + diffEnd
            } else {
              return 'Sale ended in ' + diffEnd
            }
          }

          const status = () => {
            if (isFinished) {
              return 'CLOSED'
            } else if (Date.now() / 1000 < saleStartTime.toNumber()) {
              return 'UPCOMMING'
            } else if (Date.now() / 1000 < chainData.saleEnd.toString()) {
              return 'LIVE'
            } else if (chainData.saleEnd.toNumber() === 0) {
              return 'NOT-SET'
            } else return 'ENDED'

          }

          let saleDBChain =
          {
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
              endDate: dateObject,
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

          salesData.push(saleDBChain)
          setIsLoading(false)

        }
      })

      return { salesNO, salesData }
    }

  } catch (e) { console.log("Err: ", e.message) }
}

export const fetchFeaturedsale = async () => {
  try {

    const response = await fetch(`${backendURL}/featured/true`)
    const data = await response.json()
    // console.log('Featured Data', data)
    return data

  } catch (error) {
    console.log(error.message)
  }
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
    const saleStartTime = new Date(await saleContract.saleStartTime().toString() * 1000)
    const saleEndTime = new Date(chainData.saleEnd.toString() * 1000)
    const softCap = chainData.softCap.toString() / 10 ** 18
    const hardCap = chainData.hardCap.toString() / 10 ** 18
    const minBuy = saleContract.minParticipation() / 10 ** 18
    const maxBuy = saleContract.maxParticipation() / 10 ** 18
    const tokenAddress = chainData.token.toString()
    const ownerAddress = chainData.saleOwner.toString()
    const tokenPrice = chainData.tokenPriceInBNB / 10 ** 18
    const tokenSold = chainData.totalTokensSold / 10 ** 18
    const BNBRaised = chainData.totalBNBRaised / 10 ** 18
    const publicRoundStart = await saleContract.publicRoundStartDelta().toString() * 1000
    const noOfHolders = (await saleContract.numberOfParticipants()).toNumber()

    //sale State (true or false, 7 fields)
    const isFinished = await saleContract.saleFinished()
    const isSaleSuccessful = await saleContract.isSaleSuccessful()
    const issaleCancelledTokensWithdrawn = await saleContract.saleCancelledTokensWithdrawn()
    const isCreated = chainData.isCreated
    const isEarningsWithdrawn = chainData.earningsWithdrawn
    const isLeftoverWithdrawn = chainData.leftoverWithdrawn
    const isTokensDeposited = chainData.tokensDeposited


    const noOfParticipants = await saleContract.numberOfParticipants()
    const holders = noOfParticipants.toNumber()

    //Derived fileds 

    const percentage = () => {
      const raised = chainData.totalBNBRaised / 10 ** 18
      const hardCap = chainData.hardCap / 10 ** 18
      const price = chainData.tokenPriceInBNB / 10 ** 18

      const value = raised / (hardCap * price) * 100
      if (value > 0) { return value } else { return 0 }
    }

    const timeDiff = () => {
      const diffEnd = moment(saleEndTime).fromNow()
      const diffStart = moment(saleStartTime).fromNow()
      if (isFinished) {
        return 'Sale Closed'
      } else if (Date.now() < saleStartTime) {
        return 'Sale starts in ' + diffStart
      } else if (Date.now() < saleEndTime) {
        return 'Sale ends in ' + diffEnd
      } else {
        return 'Sale ended in ' + diffEnd
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
        publicStart: publicRoundStart,
        holders: noOfHolders
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
        status: status()
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

export const participateInsale = async (selectedSale, amount) => {

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
    console.log('sale', sale.isCreated)

    if (!sale.isCreated) {
      console.log('sale Params not set')
    } else if (!sale.tokensDeposited) {
      console.log('Sale tokens were not deposited')
    } else {

      const userTierObject = await saleContract.tier(ethereum.selectedAddress);
      const userTier = userTierObject.toNumber()
      // console.log('userTier', userTier)


      if (userTier === 0) {
        console.log('No tier granted')

      } else {

        if (await saleContract.isParticipated(ethereum.selectedAddress)) {

          console.log('Already Participated')
          // console.log(amountInWei.toString())
        } else {
          //Participate
          const tx = await saleContract.participate(userTier, { value: amountInWei })
          tx.wait()
          // console.log(tx)

        }
      }
    }
  } catch (error) {
    console.log(error.message)
  }
}

export const withdraw = async (selectedSale) => {
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
    } else if (!await saleContract.saleFinished()) {
      console.log("Sale not Finished")
    } else if (! await saleContract.isParticipated(ethereum.selectedAddress)) {
      console.log('You did not participate')
    } else if (!await saleContract.isSaleSuccessful()) {
      console.log("sale Not successful")
    } else {
      const tx = await saleContract.withdraw()
      tx.wait()
      console.log('tx:', tx)
    }


  } catch (error) {
    console.log(error.message)
  }
}

export const withdrawUnused = async (selectedSale) => {
  try {


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
    } else if (!await saleContract.saleFinished()) {
      console.log("Sale not Finished")
    } else if (! await saleContract.isParticipated(ethereum.selectedAddress)) {
      console.log('You did not participate')
    } else if (await saleContract.isSaleSuccessful()) {
      console.log("sale was successful, withdraw instead")
    } else {
      const tx = await saleContract.withdrawUserFundsIfSaleCancelled()
      tx.wait()
      // console.log('tx:', tx)
    }

  } catch (error) {
    console.log(error.message)
  }
}

export const finishSale = async (selectedSale) => {
  try {

    //get sale Data
    const signer = provider.getSigner(ethereum.selectedAddress)

    //get sale address
    const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);
    const saleContract = new ethers.Contract(saleAddress, saleABI, signer)

    if (await saleContract.saleFinished()) {
      console.log('sale aready Finished')

    } else if (! await AdminContract.isAdmin(ethereum.selectedAddress)) {
      console.log('Caller not the admin')
    } else {
      //finish sale
      const tx = await saleContract.finishSale()
      tx.wait()
      // console.log('tx:', tx)
    }

  } catch (error) {
    console.log('Error:', error.message)
  }
}

export const depositTokens = async (selectedSale) => {
  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });


    if (selectedSale === 0) {
      console.log('selected sale lost, please refresh')
    } else {
      //get sale address
      const saleAddress = await FactoryContract.saleIdToAddress(selectedSale);

      //Create signer
      const signer = provider.getSigner(ethereum.selectedAddress)

      //get connect to contract
      const saleContract = new ethers.Contract(saleAddress, saleABI, signer)
      const BUSDContract = new ethers.Contract(SALETOKEN_ADDRESS, testABI, signer)

      //get sale details
      const sale = await saleContract.sale()

      //compare address
      const compare = sale.saleOwner.toString().toLowerCase() === ethereum.selectedAddress.toString().toLowerCase()
      // console.log('compare', compare)

      if (!sale.isCreated) {
        console.log('params not set')
      } else if (!compare) {
        console.log('Not sale owner')
      } else if (sale.tokensDeposited) {
        console.log("Already deposited")
      } else {
        const approve = await BUSDContract.approve(saleAddress, sale.hardCap)
        approve.wait()
        console.log("Approve", approve)

        if (approve) {
          const deposit = await saleContract.depositTokens()
          deposit.wait()
          console.log('deposit:', deposit)
        }
      }
    }

  } catch (error) {
    console.log(error.message)
  }
}

export const withdrawDeposit = async (selectedSale) => {
  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });


    if (selectedSale === 0) {
      console.log('selected sale lost, please refresh')
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
      } else if (!compare) {
        console.log('Not sale owner')
      } else if (!await saleContract.saleFinished()) {
        console.log("Sale not finished")
      } else if (await saleContract.isSaleSuccessful()) {
        console.log("sale was successful, withdraw earning instead")
      } else {
        const tx = await saleContract.withdrawDepositedTokensIfSaleCancelled()
        tx.wait()
        // console.log('tx:', tx)
      }
    }

  } catch (error) {
    console.log(error.message)
  }
}

export const withdrawEarnings = async (selectedSale) => {

  var errorMsg = document.getElementById('errormsg')
  try {

    //connect if not connected
    await ethereum.request({ method: 'eth_requestAccounts' });


    if (selectedSale === 0) {
      console.log('selected sale lost, please refresh')
      errorMsg.innerText = 'Selected sale lost, please refresh'
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
        errorMsg.innerText = 'params not set'
      } else if (!compare) {
        console.log('Not sale owner')
        errorMsg.innerText = 'Not sale owner'
      } else if (!await saleContract.saleFinished()) {
        console.log('sale still running')
        errorMsg.innerText = 'sale still running'
      } else if (! await saleContract.isSaleSuccessful()) {
        console.log("sale was cancled,withdraw deposited instead")
        errorMsg.innerText = 'sale was cancled.Withdraw deposited instead'
      } else if (sale.earningsWithdrawn) {
        console.log("Aready withdraw")
        errorMsg.innerText = "Aready withdraw"
      }
      else {
        const tx = await saleContract.withdrawEarningsAndLeftover()
        tx.wait()
        // console.log('tx:', tx)
      }
    }

  } catch (error) {
    console.log(error.message)
  }
}

export const getDeploymentFee = async () => {
  const deploymentFee = formatEther(await FactoryContract.fee())
  console.log('deploymentFee', deploymentFee)

  return deploymentFee

}
