import React from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import Tag from './Tag.jsx'
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

const style = {
  width: '100%',
  marginRight: 0,
  marginBottom: 0,
  color: 'white',
  padding: 0,
  textAlign: 'left',
  fontSize: '1rem',
  lineHeight: 'normal',
  float: 'left',
}
const TagList = ({ name, id }) => {
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
  return (
    <List>
      <ListItem button>
        <Tag id='233' name='docker1'/>
      </ListItem>
      <ListItem button>
        <Tag id='133' name='aws1'/>
      </ListItem>
    </List>
  )
}
export default TagList