import { Choropleth } from './src/choropleth';

export default {
  create(params) {
    const choropleth = new Choropleth(params);

    return choropleth;
  }
};
