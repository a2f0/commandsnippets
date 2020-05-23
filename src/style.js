import { makeStyles } from '@material-ui/core/styles';

const drawerWidth = 150;

const darkStyle = makeStyles((theme) => ({
  button: {
    textTransform: 'none'
  },
  menuButton: {
    background: "black",
    textTransform: 'none',
    padding: 0,
    minWidth: 0,
    marginRight: 10,
    "&:hover": {
      borderRadius: 0,
      color: "#FF00FF"
    },
    "&:active": {
      backgroundColor: "#585858",
      borderRadius: 0
    }
  },
  menu: {
    borderRadius: 0,
    border: 1
  },
  menuItem: {
    background: "black",
    color: 'white',
    fontSize: 12
  },
  root: {
    display: 'flex',
    background: 'black'
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
    background: "black",
    color: "white"
  },
  drawerContainer: {
    overflow: 'auto',
  },
  content: {
    flexGrow: 1,
    background: "black",
    color: "white"
  },
  toolBar: {
    minHeight: 27,
    padding: 0,
    background: "black"
  },
  title: {
    flexGrow: 1,
  },
  svgIcon: {
    color: "white",
    fontSize: 12
  },
  list: {
    padding: 0
  },
  entryBody: {
    fontSize: '1em',
    fontFamily: 'monospace',
    color: 'black',
    marginBottom: '1em',
    whiteSpace: 'pre-wrap'
  },
}));


function style() {
  return darkStyle();
}
export default style