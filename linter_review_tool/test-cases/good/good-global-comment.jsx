// The same in .jsx, which keeps core no-redeclare.
/* global $ */

export const Count = () => <span className="count">{$('.x').length}</span>;
