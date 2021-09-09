import * as request from "@arangodb/request";

export function invokeEmbeddingModel(dataToEmbed: any, base_url: string, invocation_name: string, max_retries: number = 5): any {
    const embeddingsServiceUrl = `${base_url}/v2/models/${invocation_name}/infer`;
    let tries = 0;
    let res = undefined;

    while (res == undefined || res.status !== 200 && tries < max_retries) {
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

export function chunkArray(array: any[], chunk_size: number) {
    return Array(Math.ceil(array.length / chunk_size))
        .fill(0)
        .map((_, i) => i * chunk_size)
        .map(begin => array.slice(begin, begin + chunk_size));
}
