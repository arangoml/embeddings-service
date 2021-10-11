import Request = Foxx.Request;
import Response = Foxx.Response;
import {checkCollectionIsPresent} from "../utils/db";
import {sendInvalidInputMessage} from "../utils/invalid_input";
import {retrieveModel} from "../services/model_metadata_service";
import {getEmbeddingsStateDict} from "../services/emb_status_service";
import {getEmbeddingsForKeys} from "../services/emb_retrieval_service";
import {indexOfMax} from "../utils/math";

export function retrieveEmbeddings(req: Request, res: Response): void {
    const {modelName, modelType, fieldName, collectionName, documentKeys, fullDocuments, fields, labelMapping} = req.body;
    // Check if the arguments are valid, either for word embeddings or graph embeddings
    if (!checkCollectionIsPresent(collectionName)) {
        sendInvalidInputMessage(res,
            `Collection named ${collectionName} does not exist.`);
    }

    // retrieve model metadata from document
    const modelMetadata = retrieveModel(modelName, modelType);

    if (modelMetadata == null) {
        sendInvalidInputMessage(res,
            `Invalid model: ${modelName} of type ${modelType}`);
    } else {
        if (labelMapping !== undefined && labelMapping.length !== modelMetadata.invocation.emb_dim) {
            sendInvalidInputMessage(res,
                `labelMapping doesn't have the correct number of entries. Got ${labelMapping.length}, expected ${modelMetadata.invocation.emb_dim}`);
        }

        const embStatusDict = getEmbeddingsStateDict(collectionName, fieldName, modelMetadata);
        if (embStatusDict !== undefined) {
            const embeddingsRes = getEmbeddingsForKeys(embStatusDict, documentKeys, fullDocuments, fields);
            const embeddings = embeddingsRes.embeddings.map((doc)=>{
                if (labelMapping === undefined) {
                    return doc;
                }
                return {
                    ...doc,
                    "label": labelMapping[indexOfMax(doc.embedding)]
                }
            });
            res.json({
                "embeddings": embeddings,
                "possiblyStale": embeddingsRes.possiblyStale
            });
        } else {
            sendInvalidInputMessage(res, "These embeddings don't exist!")
        }
    }
};