import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { librarianApiRef, LibrarianClient } from './api';
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';

const librarianApi = ApiBlueprint.make({
  name: 'librarian',
  params: defineParams =>
    defineParams({
      api: librarianApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new LibrarianClient({ discoveryApi, fetchApi }),
    }),
});

const librarianPage = PageBlueprint.make({
  name: 'dashboard',
  params: {
    path: '/librarian',
    title: 'Librarian',
    icon: <LibraryBooksIcon />,
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
