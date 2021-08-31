import request from "@arangodb/request";

export function invokeEmbeddingModel(dataToEmbed: any, base_url: string, invocation_name: string, max_retries: number) {
    const embeddingsServiceUrl = `${base_url}/v2/models/${invocation_name}/infer`;
    let tries = 0;
    let res = {"status": -1};

    while (res.status !== 200 && tries < max_retries) {
        const now = new Date().getTime();
        while (new Date().getTime() < now + tries) {
            // NOP
        }

        res = request.post(embeddingsServiceUrl, {
            body: dataToEmbed,
            json: true
        });
        tries++;
    }
    return res;
}