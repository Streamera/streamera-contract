const axios = require('axios');
require("dotenv").config();
const fs = require('fs').promises;
const path = require('path');
const dummyData = './dummy_data';
const _ = require('lodash');

const getBase64 = async (file) => {
    return contents = await fs.readFile(file, {encoding: 'base64'});
}

const uploadImage = async (ipfsPath, content) => {
    const options = {
        method: 'POST',
        url: 'https://deep-index.moralis.io/api/v2/ipfs/uploadFolder',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-API-Key': 'YwYYBmubw5xkpEB5ACIMF7frFigGJnpCsV1OeTN5Etb1d9BQWUemRCM1U0O34MRG'
        },
        data: JSON.stringify([{
            path: ipfsPath,
            content: content
        }])
    };
    // image[0].name,
    // await getBase64(image[0]),

    return new Promise((resolve, reject) => {
        axios
            .request(options)
            .then((response) => {
                resolve(response.data[0].path);
            })
            .catch(function (error) {
                console.error(error);
                reject(`IPFS failed`);
            });
    })
}

const uploadJSONToIPFS = async(JSONBody) => {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    //making axios POST request to Pinata ⬇️
    return axios
        .post(url, JSONBody, {
            headers: {
                pinata_api_key: key,
                pinata_secret_api_key: secret,
            }
        })
        .then(function (response) {
           return {
               success: true,
               pinataURL: "https://gateway.pinata.cloud/ipfs/" + response.data.IpfsHash
           };
        })
        .catch(function (error) {
            console.log(error)
            return {
                success: false,
                message: error.message,
            }

    });
};

const uploadFileToIPFS = async(file) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    //making axios POST request to Pinata ⬇️

    let data = new FormData();
    data.append('file', file);

    const metadata = JSON.stringify({
        name: 'testname',
        keyvalues: {
            exampleKey: 'exampleValue'
        }
    });
    data.append('pinataMetadata', metadata);

    // //pinataOptions are optional
    // const pinataOptions = JSON.stringify({
    //     cidVersion: 0,
    //     customPinPolicy: {
    //         regions: [
    //             {
    //                 id: 'FRA1',
    //                 desiredReplicationCount: 1
    //             },
    //             {
    //                 id: 'NYC1',
    //                 desiredReplicationCount: 2
    //             }
    //         ]
    //     }
    // });
    // data.append('pinataOptions', pinataOptions);

    return axios
        .post(url, data, {
            maxBodyLength: 'Infinity',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                pinata_api_key: key,
                pinata_secret_api_key: secret,
            }
        })
        .then(function (response) {
            console.log("image uploaded", response.data.IpfsHash)
            return {
               success: true,
               pinataURL: "https://gateway.pinata.cloud/ipfs/" + response.data.IpfsHash
           };
        })
        .catch(function (error) {
            console.log(error)
            return {
                success: false,
                message: error.message,
            }

    });
};

(async() => {
    let allDir = await fs.readdir(path.join(__dirname, dummyData));
    allDir = _.without(allDir, '.DS_Store');
    let updatedUrl = [];

    for (let dir of allDir) {
        let dummyImages = await fs.readdir(path.join(__dirname, `${dummyData}/${dir}`));
        console.log(dummyImages);

        for (let img of dummyImages) {
            if (img.indexOf('.DS_Store') >= 0) {
                continue;
            }

            // for moralis ipfs
            const imgPath = path.join(__dirname, `${dummyData}/${dir}/${img}`);
            const ipfsPath = imgPath.slice(imgPath.lastIndexOf('_data/') + 6).replaceAll('.jpg', '');
            const imgContent = await getBase64(imgPath);

            // prepare chain & name for description
            const chainName = ipfsPath.substring(0, ipfsPath.lastIndexOf('/'));
            const baseName = path.basename(ipfsPath, '.jpg').replaceAll('-', ' ');

            // update to moralis
            const ipfsURL = await uploadImage(ipfsPath, imgContent);
            console.log(ipfsURL);

            // create json metadata
            const jsonData = {
                "name": baseName,
                "creator": "0x1cc5F2F37a4787f02e18704D252735FB714f35EC",
                "image": ipfsURL,
                "description": `${chainName}'s ${baseName}`
            };
            const ipfsJSON = await uploadImage(`metadata/${ipfsPath}`, jsonData);
            console.log(ipfsJSON);
        }


    }
})();
