// The Worker entrypoint. workerd treats every export of this module as a
// handler, so the app and its constants live in ./app.
import {app} from './app';

export default app;
