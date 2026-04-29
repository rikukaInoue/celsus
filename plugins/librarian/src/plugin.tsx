import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { librarianApiRef, LibrarianClient } from './api';

const librarianApi = ApiBlueprint.make({
  params: {
    factory: createApiFactory({
      api: librarianApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new LibrarianClient({ discoveryApi, fetchApi }),
    }),
  },
});

const librarianPage = PageBlueprint.make({
  params: {
    defaultPath: '/librarian',
    loader: () =>
      import('./components/LibrarianDashboard').then(m => (
        <m.LibrarianDashboard />
      )),
  },
});

export const librarianPlugin = createFrontendPlugin({
  id: 'librarian',
  extensions: [librarianApi, librarianPage],
});
