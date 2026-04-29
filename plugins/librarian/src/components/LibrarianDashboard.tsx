import { useApi } from '@backstage/core-plugin-api';
import { useState, useEffect, useCallback } from 'react';
import { librarianApiRef } from '../api';
import type { LibrarianStats, PopularEntity, SearchResult } from '../api';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import VisibilityIcon from '@material-ui/icons/Visibility';
import PeopleIcon from '@material-ui/icons/People';
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
import Chip from '@material-ui/core/Chip';
import { makeStyles } from '@material-ui/core/styles';
import { Link } from 'react-router-dom';

const useStyles = makeStyles(theme => ({
  statCard: {
    textAlign: 'center',
    padding: theme.spacing(2),
  },
  statNumber: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  statLabel: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  statIcon: {
    fontSize: '2rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  searchField: {
    marginBottom: theme.spacing(3),
  },
  rankNumber: {
    fontWeight: 700,
    color: theme.palette.primary.main,
    width: 40,
  },
  entityLink: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
  kindChip: {
    marginLeft: theme.spacing(1),
  },
  scoreChip: {
    fontWeight: 700,
  },
  section: {
    marginTop: theme.spacing(4),
  },
}));

function StatCard(props: { icon: JSX.Element; value: number; label: string }) {
  const classes = useStyles();
  return (
    <Card>
      <CardContent className={classes.statCard}>
        <div className={classes.statIcon}>{props.icon}</div>
        <Typography className={classes.statNumber}>{props.value}</Typography>
        <Typography className={classes.statLabel}>{props.label}</Typography>
      </CardContent>
    </Card>
  );
}

function entityRefToPath(entityRef: string): string {
  const [kindNs, name] = entityRef.split('/');
  const [kind, namespace] = kindNs.split(':');
  return `/catalog/${namespace}/${kind}/${name}`;
}

export function LibrarianDashboard() {
  const classes = useStyles();
  const api = useApi(librarianApiRef);
  const [stats, setStats] = useState<LibrarianStats | null>(null);
  const [popular, setPopular] = useState<PopularEntity[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats);
    api.getPopular().then(setPopular);
  }, [api]);

  const handleSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      const r = await api.search(q);
      setResults(r);
      setSearching(false);
    },
    [api],
  );

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  return (
    <div>
      <Grid container spacing={3}>
        <Grid item xs={3}>
          <StatCard
            icon={<VisibilityIcon fontSize="inherit" />}
            value={stats?.totalViews ?? 0}
            label="総閲覧数"
          />
        </Grid>
        <Grid item xs={3}>
          <StatCard
            icon={<TrendingUpIcon fontSize="inherit" />}
            value={stats?.todayViews ?? 0}
            label="本日の閲覧"
          />
        </Grid>
        <Grid item xs={3}>
          <StatCard
            icon={<LibraryBooksIcon fontSize="inherit" />}
            value={stats?.uniqueEntities ?? 0}
            label="閲覧されたエンティティ"
          />
        </Grid>
        <Grid item xs={3}>
          <StatCard
            icon={<PeopleIcon fontSize="inherit" />}
            value={stats?.uniqueUsers ?? 0}
            label="ユニークユーザー"
          />
        </Grid>
      </Grid>

      <div className={classes.section}>
        <TextField
          className={classes.searchField}
          fullWidth
          variant="outlined"
          placeholder="エンティティを検索..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {results.length > 0 && (
          <Card>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>エンティティ</TableCell>
                  <TableCell>説明</TableCell>
                  <TableCell>スコア</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.entityRef}>
                    <TableCell>
                      <Link
                        to={entityRefToPath(r.entityRef)}
                        className={classes.entityLink}
                      >
                        {r.name}
                      </Link>
                      <Chip
                        size="small"
                        label={r.kind}
                        className={classes.kindChip}
                      />
                    </TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.score}
                        color="primary"
                        className={classes.scoreChip}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        {searching && (
          <Typography color="textSecondary">検索中...</Typography>
        )}
      </div>

      <div className={classes.section}>
        <Typography variant="h6" gutterBottom>
          人気ランキング
        </Typography>
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>エンティティ</TableCell>
                <TableCell>閲覧数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {popular.map((p, i) => (
                <TableRow key={p.entityRef}>
                  <TableCell className={classes.rankNumber}>
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={entityRefToPath(p.entityRef)}
                      className={classes.entityLink}
                    >
                      {p.entityRef}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={`${p.viewCount} views`}
                      color="primary"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {popular.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="textSecondary" align="center">
                      まだ閲覧データがありません
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
