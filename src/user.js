import { observable } from "mobx"

class ObservableUser {
	@observable userName = '';
}

const observableUser = new ObservableUser();
export default observableUser;