const LANGUAGE = process.env.LANGUAGE;
const PROJECT = process.env.PROJECT;

const getGraphQLQuery = (type, variable) => {
  if (type?.toLowerCase() === "item") {
    return `query{
      item(path:"${variable}",language:"${LANGUAGE}"){
              id
              path
              template{
                id
                name
              }
              assetTitle: field(name: "assetTitle") {
                value
              }
              assetDescription: field(name: "assetDescription") {
                value
              }
              businessSegment: field(name: "businessSegment") {
                ... on LookupField {
                  targetItem {
                    field(name: "businessSegmentName") {
                      value
                    }
                  }
                }
              }
            businessUnit: field(name: "businessUnit"){
              ... on LookupField{
                targetItem{
                   field(name: "businessUnitName"){
                    value
                  }
                }
              }
            }
            mediaItem: field(name: "mediaItem"){
              ... on LookupField{
                targetItem{
                  field: url{
                    value: url
                  }
                }
              }
            }
            assetType: field(name:"assetType"){
              ... on LookupField{
               targetItem{
                 field: url{
                   value: url
                 }
               }
             }
           }
            }
          }`;
  }
  let newVariable = variable;
  if (
    variable?.split("/")?.[0]?.toLowerCase() === "nov" &&
    variable?.substring(3)
  ) {
    newVariable = variable?.substring(3);
  }
  return `query{
    layout(routePath:"${newVariable}", site:"${PROJECT}",language:"${LANGUAGE}"){
      item{
        id
        path
        template{
        id
        name
      }
        businessSegments: field(name:"businessSegments"){
         ... on MultilistField{
           targetItems{
             field(name:"businessSegmentName"){
               value
             }
           }
         }
       }
       contentTag: field(name: "contentTag"){
        ... on LookupField{
          targetItem{
            field(name:"tag"){
              value
            }
          }
        }
       }
       businessUnits: field(name:"businessUnits"){
         ... on MultilistField{
           targetItems{
             field(name: "businessUnitName"){
               value
             }
           }
         }
       }
       brands:field(name: "brands"){
         ... on MultilistField{
           targetItems{
             field(name: "brandName"){
               value
             }
           }
         }
       }
       capabilities: field(name: "capabilities"){
         ... on MultilistField{
           targetItems{
             field(name: "capabilityName"){
               value
             }
           }
         }
       }
       categories: field(name: "categories"){
         ... on MultilistField{
           targetItems{
             field(name: "categoryName"){
               value
             }
           }
         }
       }
       pageUrl: url{
         url
       }
       imageUrl:field(name: "cardImage"){
         ... on ImageField{
           src
         }
       }
       title: field(name: "Title"){
         value
       }
       description: field(name:"metaDescription"){
         value
       }
       date: field(name:"date"){
         value
       }
      }
    }
  }
  `;
};

const fieldsNames = {
  brands: "brands",
  businessSegment: "business_segments",
  type: "type",
  businessUnit: "business_unit",
  capability: "capability",
  category: "category",
  country: "country",
  date: "date",
  description: "description",
  id: "id",
  imageUrl: "image_url",
  pageUrl: "url",
  name: "name",
  title: "name",
  breadcrumbs: "breadcrumbs",
  body: "body",
  assetTitle: "name",
  assetDescription: "description",
  mediaItem: "url",
  assetType: "category",
  application: "application",
  contentTag: "type",
};

module.exports = {
  getGraphQLQuery,
  fieldsNames,
};
