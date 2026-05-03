import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
  AnalyticsImplementationBlueprint,
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

const librarianAnalytics = AnalyticsImplementationBlueprint.make({
  name: 'librarian-tracker',
  params: defineParams =>
    defineParams({
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) => {
        const client = new LibrarianClient({ discoveryApi, fetchApi });
        return {
          captureEvent(event) {
            if (event.action !== 'navigate') return;

            const path = event.subject;
            const match = path.match(
              /^\/catalog\/([^/]+)\/([^/]+)\/([^/]+)/,
            );
            if (match) {
              const [, namespace, kind, name] = match;
              const entityRef = `${kind}:${namespace}/${name}`;
              client.recordView(entityRef).catch(() => {});
            }
          },
        };
      },
    }),
});

export const librarianPlugin = createFrontendPlugin({
  pluginId: 'librarian',
  extensions: [librarianApi, librarianPage, librarianAnalytics],
});
