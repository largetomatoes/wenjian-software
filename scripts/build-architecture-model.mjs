import {rolldown} from 'rolldown';
const bundle=await rolldown({input:'scripts/architecture-model-entry.ts',platform:'node',treeshake:true});
await bundle.write({file:'work/mac-app/asar-src/notebook-model.cjs',format:'cjs'});await bundle.close();
