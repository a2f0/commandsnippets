import React from "react";
import constructApiUrl from './api.mjs';
class NewEntry extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      subject: '',
      body: '',
    };
    this.handleSubjectChange = this.handleSubjectChange.bind(this);
    this.handleBodyChange = this.handleBodyChange.bind(this);
  }

  saveEntry( ) {
    var payload = {
      'data': {
        'type': 'TextEntry',
        'attributes': {
          'subject': this.state.subject,
          'body': this.state.body
        }
      }
    }
    const base_url = constructApiUrl();
    var url = base_url + '/api/v1/entries';
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/vnd.api+json',
      }
    })
      .then(res => res.json())
      .then((res) => {
        console.log(res)
        this.setState({subject: ''});
        this.setState({body: ''});
        this.showNewEntry();
      })
      .catch(console.log);
  }

  showNewEntry( ) {
    this.props.parentShowNewEntry();
  }

  handleSubjectChange(event) {
    this.setState({subject: event.target.value});
  }

  handleBodyChange(event) {
    this.setState({body: event.target.value});
  }

  render() {

    return (
      <div>
        <div>
          <input type="text" id="subject" name="subject"  value={this.state.subject} onChange={this.handleSubjectChange}></input>
        </div>
        <div>
          <input type="text" id="body" name="body" value={this.state.body} onChange={this.handleBodyChange}></input>
        </div>
        <div>
          <div className="create-entry-button" onClick={() => this.saveEntry()}>
          Save
          </div>
          <div className="create-entry-button" onClick={() => this.showNewEntry()}>
          Cancel
          </div>
        </div>
      </div>
    )
  }
}

export default NewEntry;
