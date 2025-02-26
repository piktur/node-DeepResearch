import type { BraveSearchResponse } from "#src/types.js";
import axios from "axios";


export async function braveSearch(query: string): Promise<{ response: BraveSearchResponse }> {
  const response = await axios.get<BraveSearchResponse>('https://api.search.brave.com/res/v1/web/search', {
    params: {
      q: query,
      count: 10,
      safesearch: 'off'
    },
});

  // Maintain the same return structure as the original code
  return { response: response.data };
}
