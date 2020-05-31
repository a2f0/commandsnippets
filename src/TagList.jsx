import React, {useEffect, useState} from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import Tag from './Tag.jsx'
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import memoize from "memoize-one";
import { makeStyles } from '@material-ui/core/styles';

import API from './api.js'

const useStyles = makeStyles({
  root: {
    paddingTop: 2,
    paddingBottom: 0,
    paddingLeft: 10,
    paddingRight: 0
  },
  item: {
    padding: 0,
    minWidth: 0,
    // width: 'inherit',
    display: 'inline-block'
  }
});


const TagList = React.memo(function TagList(props) {

  const [data, setData] = useState([]);
  const [included, setIncluded] = useState([]);
  const [sort, setSort] = useState('name');
  
  useEffect(() => {
    const fetchData = async () => {
      const sort_string = '?sort=' + sort
      const response = await API.get('/tags' + sort_string);
      setData(response.data.data);
      setIncluded(response.data.included); 
    }
    fetchData();
  }, []);

  const [{ canDrop, isOver }, drop] = useDrop({
    accept: ItemTypes.ENTRY,
    drop: () => ({ 
      name: name, 
      id: id, 
      type: 'Tag' }),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })
  const isActive = canDrop && isOver
  let backgroundColor = 'black'
  if (isActive) {
    backgroundColor = 'white'
  } else if (canDrop) {
    backgroundColor = 'gray'
  }

  const getSortedTags = (sort) => {
    if (sort === this.state.tagSort) {
      // Then the sort attribute stayed the same, reverse the order.
      if (this.state.tagDescending === false) {
        sort = '-' + sort
      }
      this.setState({ tagDescending: !this.state.tagDescending })
    } else {
      // Then the sort attribute changed.
      this.setState({ tagSort: sort })
      // When sorting tags by created, the most recent should be on top.
      if (sort === 'date_created') {
        sort = '-' + sort
        this.setState({ tagDescending: true })
      } else {
        // Reset the sort order to ascending.
        this.setState({ tagDescending: false })
      }
    }
    this.getTags(sort);
  };

  // const getTags = memoize(
  //   (sort) => {
  //     var url = 'http://localhost:9001/api/v1/tags';
  //     var querystring = "?"
  //     if (sort != undefined) {
  //       querystring = querystring + 'sort=' + sort
  //     } else {
  //       querystring = querystring + 'sort=name'
  //     }

  //     if (querystring != '?') {
  //       url = url + querystring
  //     }
  //     fetch(url, {
  //       method: 'GET',
  //       credentials: 'include'
  //     })
  //       .then(res => res.json())
  //       .then((res) => {
  //         this.setState({ tags: res })
  //       })
  //       .catch(console.log)
  //   }
  // );

  const classes = useStyles();
  return (
    <List className={classes.root}>
      {data.map((tag, i) => {
        return (
          <div className={classes.container}>
            <ListItem className={classes.item} key={tag.id} button>
              <Tag id={tag.id} name={tag.attributes.name}/>
            </ListItem>
          </div>
        )
      })}
    </List>
  )
})
export default TagList