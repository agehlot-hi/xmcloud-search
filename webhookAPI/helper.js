const axios = require("axios");
const { logger } = require("../logger");
const { getGraphQLQuery, fieldsNames } = require("./constant");
const ENTITY_DEFINITION = process.env.ENTITY_DEFINITION;
const SEARCH_PUSH_APIKEY = process.env.SEARCH_PUSH_APIKEY;
const GRAPHQL_APIKEY = process.env.GRAPHQL_APIKEY;
const SEARCH_PUSH_API_ENDPOINT = process.env.SEARCH_PUSH_API_ENDPOINT;
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;
const TYPE_DETAIL = process.env.TYPE_DETAIL;
const PRODUCT_TEMPLATE_ID = process.env.PRODUCT_TEMPLATE_ID;
const { writeToLogs } = require("../logger");

const getFormattedData = (responseData, isItem) => {
  if (isItem) {
    //console.log('Prosessing:' + JSON.stringify(responseData?.data));
    const newApiResponse = {};
    const apiResponse = responseData?.data?.item;
    if (apiResponse && Object.keys(apiResponse)) {
      let newType = {};
      if (
        TYPE_DETAIL &&
        TYPE_DETAIL !== "" &&
        TYPE_DETAIL !== null &&
        JSON.parse(TYPE_DETAIL)
      ) {
        newType = JSON.parse(TYPE_DETAIL);
      }
      Object.keys(apiResponse)?.forEach((fieldsName) => {
        //console.log('processing field:'+ fieldsName);
        const newFieldsName = fieldsNames[fieldsName] || fieldsName;
        switch (fieldsName) {
          case "template":
          case "path":
            break;
          case "id":
            newApiResponse[newFieldsName] = apiResponse?.[fieldsName];
            break;
          case "assetTitle":
          case "assetDescription":
            newApiResponse[newFieldsName] = apiResponse?.[fieldsName]?.value;
            break;
          case "businessSegment":
          case "businessUnit":
            newApiResponse[newFieldsName] = [
              apiResponse?.[fieldsName]?.targetItem?.field?.value,
            ]?.filter((data) => {
              if (data) {
                return data;
              }
            });
            break;
          case "assetType":
            newApiResponse[newFieldsName] = (apiResponse?.[fieldsName]?.targetItem?.field?.value || "")?.split(",").filter(Boolean);
            //newApiResponse[newFieldsName] = [(value?.[value?.length - 1])?.split(",").filter(Boolean)];
            break;
          case "mediaItem":
            newApiResponse[newFieldsName] =
              apiResponse?.[fieldsName]?.targetItem?.field?.value;
            newApiResponse.type = "Media";
            if (
              newType &&
              newType?.[
                apiResponse?.[fieldsName]?.targetItem?.field?.value
                  ?.substring(
                    apiResponse?.[fieldsName]?.targetItem?.field?.value.length -
                      6
                  )
                  ?.split(".")?.[1]
              ]
            ) {
              newApiResponse.type =
                newType[
                  apiResponse?.[fieldsName]?.targetItem?.field?.value
                    ?.substring(
                      apiResponse?.[fieldsName]?.targetItem?.field?.value
                        .length - 6
                    )
                    ?.split(".")[1]
                ];
            }
            break;
          default:
            newApiResponse[newFieldsName] = apiResponse?.[fieldsName] ?? "";
            break;
        }
      });
    }
    return {
      ...newApiResponse,
      segment_unit_breadcrumbs: processSegmentUnit(newApiResponse)?.split(",").filter(Boolean),
      category_breadcrumbs: processCategories(apiResponse?.categories)?.split(",").filter(Boolean),
    };
  } else {
    const data = {};
    const apiResponse = responseData?.data?.layout?.item;
    if (apiResponse && Object.keys(apiResponse)) {
      Object.keys(apiResponse)?.forEach((fieldsName) => {
        const newFieldsName = fieldsNames[fieldsName] || fieldsName;
        switch (fieldsName) {
          case "template":
          case "path":
            break;
          case "contentTag":
            data[newFieldsName] =
              apiResponse?.[fieldsName]?.targetItem?.field?.value;
            break;
          case "id":
            data[newFieldsName] = apiResponse?.[fieldsName];
            break;
          case "title":
          case "description":
          case "date":
            data[newFieldsName] = apiResponse?.[fieldsName]?.value;
            break;
          case "imageUrl":
            data[newFieldsName] = apiResponse?.[fieldsName]?.src;
            break;
          case "pageUrl":
            data[newFieldsName] = apiResponse?.[fieldsName]?.url;
            break;
          case "businessSegments":
          case "businessUnits":
          case "categories":
          case "capabilities":
          case "brands":
            data[newFieldsName] = apiResponse?.[fieldsName]?.targetItems
              ?.map((data) => data?.field?.value)
              ?.filter((data) => {
                if (data) {
                  return data;
                }
              });

            break;
          default:
            data[newFieldsName] = apiResponse?.[fieldsName];
            break;
        }
      });
    }
    return {
      ...data,
      segment_unit_breadcrumbs: processSegmentUnit(newApiResponse)?.split(",").filter(Boolean),
      category_breadcrumbs: processCategories(apiResponse?.categories)?.split(",").filter(Boolean),
    };
  }
};

function processCategories(categories) {
	let mypath = "";
    if(categories !== null && typeof categories !== 'undefined' && categories.length > 0)
    {
        categories.forEach(replaceUrl);
        for (let i = 0; i < categories.length; i++) {
            if(categories[i].url?.length > 0)
                mypath += categories[i].url + ","	
        }
    }
    return mypath?.trim().slice(0, -1); //to remove last ,
};

function processSegmentUnit(dtm) {
	let segment = "";
  //data?.business_segments[0] ?? ""}/${data?.business_unit[0]
    if(dtm?.business_segments[0] !== null && typeof dtm?.business_segments[0] !== 'undefined' && dtm?.business_segments[0].length > 0)
    {
        segment = dtm?.business_segments[0]
    }
    if(dtm?.business_unit[0] !== null && typeof dtm?.business_unit[0] !== 'undefined' && dtm?.business_unit[0].length > 0)
    {
        if(dtm?.business_segments[0] !== null && typeof dtm?.business_segments[0] !== 'undefined' && dtm?.business_segments[0].length > 0)
            segment = segment + "," + segment + "/"

        segment = segment + dtm?.business_unit[0]
    }
    return segment;
};

function replaceUrl(item) {
  item.url = item.url.replace("/Data/System/Categories-Folder/", "").replaceAll("-", " ");
};


// program to split array into smaller chunks

function splitIntoChunk(arr, chunk, splitedArr) {

  while(arr.length > 0) {

      let tempArray;
      tempArray = arr.splice(0, chunk);
      splitedArr.push(tempArray);
  }
}

async function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

const pullAndFormatItemDetailsInBatch = async (data) => {
  try {
    //writeToLogs('Starting graphql GRAPHQL_ENDPOINT:' + GRAPHQL_ENDPOINT + ' , GRAPHQL_APIKEY:' + GRAPHQL_APIKEY + ', Proxy:' + process?.env?.http_proxy );

    let splitedArr =[];
    splitIntoChunk(data, 50, splitedArr);
    let itemDetailArray=[];
    
    for (let i = 0; i < splitedArr.length; i++) {
      let itemDetailChunk = await axios.all(
        splitedArr[i]?.map((endpoint) =>
          axios({
            method: "POST",
            url: GRAPHQL_ENDPOINT,
            headers: {
              SC_APIKEY: GRAPHQL_APIKEY,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            data: {
              query: getGraphQLQuery(
                endpoint?.entity_definition,
                endpoint?.identifier
              ),
            },
          }).then((response) => {
            //console.log('axios log: ', response)
            //writeToLogs('axios log:' + response);
            return response
          }).catch(err => { writeToLogs('Error while calling the GraphQL foreach item, err:' + err + ', errResObj:' + err?.response?.data + ', Data:' + JSON.stringify(endpoint));  })
        ), { batchSize: 20, delay: 1000, maxConcurrent : 2 } 
      ).catch((error) => { writeToLogs('Error while calling the GraphQL foreach all items, error:' + error);  });
      
      if(itemDetailChunk == null || typeof itemDetailChunk == 'undefined' || itemDetailChunk.length <= 0) 
      {
        writeToLogs('Error while calling the GraphQL query, itemDetails:' + itemDetailChunk);
        return;
      }

      itemDetailArray.push(itemDetailChunk);

      //wait for 1 sec for next processing
      await sleep(1000);
    }

    const productList = PRODUCT_TEMPLATE_ID?.split("|") || [];
    let itemDetails = itemDetailArray.flat();

    const itemsToBoProcessed = itemDetails?.filter((response) => {
        const productId = response?.data?.data?.item?.template?.id || response?.data?.data?.layout?.item?.template?.id;
        if (productList?.includes(productId)) {
          return response?.data;
        }
      })

      if(itemsToBoProcessed == null || typeof itemsToBoProcessed == 'undefined' || itemsToBoProcessed?.len <= 0) 
      {
        writeToLogs('Error while filter the items by template id: ' + productList.toString() + ', itemsToBoProcessed:' + JSON.stringify(itemsToBoProcessed));
        return;
      }
      let dataMappedWithSearchSchema = itemsToBoProcessed?.map((apiResponse) => {
        const isItem = true;
          // const isItem = itemDetails?.filter((item) =>
          //                   item.identifier === apiResponse?.data?.item?.id ||
          //                   item.identifier === apiResponse?.data?.layout?.item?.id
          //               )?.[0]?.entity_definition === "Item";
        let mydata = getFormattedData(apiResponse.data, isItem);

        const data = {
          document: {
            fields: mydata, //getFormattedData(apiResponse, isItem),
            id: mydata?.id,
            //id: apiResponse?.data?.item?.id || apiResponse?.data?.layout?.item?.id,
          },
        };
        return data;
      })

      if(dataMappedWithSearchSchema == null || typeof dataMappedWithSearchSchema == 'undefined') 
      {
        writeToLogs('Error while calling the GraphQL query, dataMappedWithSearchSchema:' + JSON.stringify(dataMappedWithSearchSchema));
        return;
      }
      //writeToLogs('Returning the dataMappedWithSearchSchema:' + JSON.stringify(dataMappedWithSearchSchema));
      return dataMappedWithSearchSchema;

    } catch (err) {
      writeToLogs("Error in pullAndFormatItemDetails:", JSON.stringify(err));
      return { error: err?.response?.data?.error || '', data: JSON.stringify(err) };
  }
};


const postDataToSearchServerInBatch = async (data) => {
  try {
    //writeToLogs('Starting pushing to Search, SEARCH_PUSH_API_ENDPOINT:' + SEARCH_PUSH_API_ENDPOINT + ' , SEARCH_PUSH_APIKEY:' + SEARCH_PUSH_APIKEY );
    let splitedArr =[];
    splitIntoChunk(data, 50, splitedArr);
    let itemDetailArray=[];
    
    for (let i = 0; i < splitedArr.length; i++) {
      const firstAPIResponse = await axios.all(
        splitedArr[i]?.map((endpointData) => {
          return axios.put(
            SEARCH_PUSH_API_ENDPOINT + endpointData?.document?.id + "?locale=en_us",
            endpointData,
            {
              headers: {
                authorization: SEARCH_PUSH_APIKEY,
              },
            }
          ).then((response) => {
            //writeToLogs('axios log:' + response);
            return response
          }).catch(err => { writeToLogs('Error while calling Search API foreach item, err:' + err + ', URL: ' + SEARCH_PUSH_API_ENDPOINT + ', APIKey: ' + SEARCH_PUSH_APIKEY + ', errResObj:' + JSON.stringify(err?.response?.data) + ', data:' + JSON.stringify(endpointData));  });
        }), { batchSize: 50, delay: 1000 }
      );
      itemDetailArray.push(firstAPIResponse);
      //Wait for a 1 sec to next call
      //await sleep(1000);
    }
 
    const response = itemDetailArray?.flat()?.map((response, index) => {
      return response?.data;
    });

    return response;
  } catch (err) {
    writeToLogs('Error while calling Search API ' + SEARCH_PUSH_API_ENDPOINT + ', Error:' + err);
    return { error: err?.response?.data?.error || '', data: data };
  }
};


module.exports = {
  pullAndFormatItemDetailsInBatch,
  postDataToSearchServerInBatch,
  sleep,
};
